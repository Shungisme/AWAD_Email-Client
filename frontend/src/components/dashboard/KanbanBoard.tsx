import React, { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  Clock,
  CheckCircle,
  Inbox,
  MoreVertical,
  ExternalLink,
  Sparkles,
  Loader2,
  Filter,
  ArrowUpDown,
  Settings as SettingsIcon,
  Star,
  Archive,
  Send,
  AlertCircle,
  Zap,
  Target,
  Flag,
} from "lucide-react";
import type { Email, EmailStatus } from "../../types";
import * as emailsAPI from "../../api/emails.api";
import { getKanbanConfig } from "../../api/kanban.api";
import KanbanSettings from "./KanbanSettings";

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  Inbox: <Inbox className="w-5 h-5" />,
  Clock: <Clock className="w-5 h-5" />,
  CheckCircle: <CheckCircle className="w-5 h-5" />,
  Star: <Star className="w-5 h-5" />,
  Archive: <Archive className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
  Send: <Send className="w-5 h-5" />,
  AlertCircle: <AlertCircle className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  Flag: <Flag className="w-5 h-5" />,
};

interface KanbanBoardProps {
  mailboxId?: string; // Optional - Kanban shows all emails by status
  onSelectEmail: (email: Email) => void;
  onGenerateSummary?: (emailId: string) => Promise<string | null>; // Returns summary
}

interface Column {
  id: string; // React key (UUID)
  status: string; // Email status identifier
  title: string;
  icon: React.ReactNode;
  color: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  mailboxId,
  onSelectEmail,
  onGenerateSummary,
}) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [emailsByStatus, setEmailsByStatus] = useState<Record<string, Email[]>>(
    {},
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggingEmail, setDraggingEmail] = useState<Email | null>(null);
  const [snoozeEmailId, setSnoozeEmailId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [customSnoozeModal, setCustomSnoozeModal] = useState<{
    emailId: string;
    show: boolean;
  } | null>(null);
  const [customSnoozeDate, setCustomSnoozeDate] = useState<string>("");
  const [customSnoozeTime, setCustomSnoozeTime] = useState<string>("");

  // F3: Filter & Sort State
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterAttachments, setFilterAttachments] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Load Kanban configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getKanbanConfig();
        const loadedColumns: Column[] = config.columns
          .sort((a, b) => a.order - b.order)
          .map((col) => ({
            id: col.id,
            status: col.status,
            title: col.title,
            icon: ICON_MAP[col.icon] || <Inbox className="w-5 h-5" />,
            color: col.color,
          }));
        setColumns(loadedColumns);

        // Initialize emailsByStatus with empty arrays for each status
        const initialEmails: Record<string, Email[]> = {};
        loadedColumns.forEach((col) => {
          initialEmails[col.status] = [];
        });
        setEmailsByStatus(initialEmails);
      } catch (error) {
        console.error("Failed to load Kanban config:", error);
        // Fallback to default columns
        const defaultColumns: Column[] = [
          {
            id: "col-inbox",
            status: "inbox",
            title: "Inbox",
            icon: <Inbox className="w-5 h-5" />,
            color: "bg-blue-500",
          },
          {
            id: "col-todo",
            status: "todo",
            title: "To Do",
            icon: <Clock className="w-5 h-5" />,
            color: "bg-yellow-500",
          },
          {
            id: "col-done",
            status: "done",
            title: "Done",
            icon: <CheckCircle className="w-5 h-5" />,
            color: "bg-green-500",
          },
        ];
        setColumns(defaultColumns);
        setEmailsByStatus({ inbox: [], todo: [], done: [] });
      }
    };
    loadConfig();
  }, []);

  // Auto-fetch emails when columns are loaded
  useEffect(() => {
    if (columns.length > 0) {
      fetchEmailsByStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length]); // Only trigger when columns count changes, not function reference

  // Fetch emails grouped by status
  const fetchEmailsByStatus = useCallback(async () => {
    if (columns.length === 0) return; // Wait for columns to load

    try {
      setLoading(true);

      // Optional: Sync from Gmail if mailboxId is available
      // Otherwise, just fetch from MongoDB directly
      if (mailboxId) {
        try {
          await emailsAPI.fetchMailboxEmails(mailboxId, 1, 50);
        } catch (error) {
          console.warn(
            "Failed to sync mailbox, continuing with DB data:",
            error,
          );
        }
      }

      // Now fetch emails by status from MongoDB
      const statusPromises = columns.map((col) =>
        emailsAPI.fetchEmailsByStatus(col.status as EmailStatus),
      );

      const results = await Promise.all(statusPromises);
      const newEmailsByStatus: Record<string, Email[]> = {};

      results.forEach((emails, index) => {
        const status = columns[index].status;
        newEmailsByStatus[status] = emails;
      });

      setEmailsByStatus(newEmailsByStatus);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [mailboxId, columns]);

  const handleConfigUpdated = () => {
    // Reload config and refetch emails
    window.location.reload(); // Simple approach - reload the page
  };

  const handleGenerateSummary = async (
    e: React.MouseEvent,
    emailId: string,
  ) => {
    e.stopPropagation();
    if (!onGenerateSummary || generatingIds.has(emailId)) return;

    setGeneratingIds((prev) => new Set(prev).add(emailId));
    try {
      const summary = await onGenerateSummary(emailId);

      // Update local state with the new summary (no need to re-fetch from backend)
      if (summary) {
        setEmailsByStatus((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((status) => {
            updated[status] = updated[status].map((email) =>
              email.id === emailId ? { ...email, summary } : email,
            );
          });
          return updated;
        });
      }
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  };

  useEffect(() => {
    // Fetch emails immediately, mailboxId is optional
    fetchEmailsByStatus();

    // Refresh every 60 seconds to check for expired snoozes
    const interval = setInterval(fetchEmailsByStatus, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxId]); // Re-run when mailboxId changes (or initially when undefined)

  // Handle drag start
  const handleDragStart = (email: Email) => {
    setDraggingEmail(email);
  };

  // Handle drag over (allow drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle drop
  const handleDrop = async (targetStatus: string, e: React.DragEvent) => {
    e.preventDefault();

    if (!draggingEmail || draggingEmail.status === targetStatus) {
      setDraggingEmail(null);
      return;
    }

    try {
      // If dropping to snoozed column, set default snooze time (1 hour)
      if (targetStatus === "snoozed") {
        const snoozeUntil = new Date();
        snoozeUntil.setHours(snoozeUntil.getHours() + 1);

        await emailsAPI.snoozeEmail(draggingEmail.id, {
          snoozeUntil: snoozeUntil.toISOString(),
        });

        // Update local state with snooze info
        const sourceStatus = draggingEmail.status;
        setEmailsByStatus((prev) => ({
          ...prev,
          [sourceStatus]: prev[sourceStatus].filter(
            (e) => e.id !== draggingEmail.id,
          ),
          snoozed: [
            ...prev.snoozed,
            {
              ...draggingEmail,
              status: "snoozed",
              snoozeUntil: snoozeUntil.toISOString(),
            },
          ],
        }));
      } else {
        // Update status on backend
        await emailsAPI.updateEmailStatus(
          draggingEmail.id,
          targetStatus as EmailStatus,
        );

        // Update local state
        const sourceStatus = draggingEmail.status;
        setEmailsByStatus((prev) => ({
          ...prev,
          [sourceStatus]: prev[sourceStatus].filter(
            (e) => e.id !== draggingEmail.id,
          ),
          [targetStatus]: [
            ...prev[targetStatus],
            {
              ...draggingEmail,
              status: targetStatus as EmailStatus,
              snoozeUntil: null,
            },
          ],
        }));
      }
    } catch (error) {
      console.error("Failed to update email status:", error);
    } finally {
      setDraggingEmail(null);
    }
  };

  // Handle snooze
  const handleSnooze = async (emailId: string, hoursOrDate: number | Date) => {
    try {
      const snoozeUntil =
        hoursOrDate instanceof Date
          ? hoursOrDate
          : (() => {
              const date = new Date();
              date.setHours(date.getHours() + hoursOrDate);
              return date;
            })();

      await emailsAPI.snoozeEmail(emailId, {
        snoozeUntil: snoozeUntil.toISOString(),
      });

      // Update local state - move email to snoozed column
      setEmailsByStatus((prev) => {
        let emailToSnooze: Email | null = null;
        let sourceStatus: string | null = null;

        // Find the email in any column
        for (const status in prev) {
          const found = prev[status]?.find((e) => e.id === emailId);
          if (found) {
            emailToSnooze = found;
            sourceStatus = status;
            break;
          }
        }

        if (!emailToSnooze || !sourceStatus) return prev;

        // Create new state with email moved to snoozed
        const newState = { ...prev };

        // Remove from source column
        newState[sourceStatus] = prev[sourceStatus].filter(
          (e) => e.id !== emailId,
        );

        // Add to or update in snoozed column
        if (sourceStatus === "snoozed") {
          // Already in snoozed, just update the snoozeUntil time
          newState.snoozed = prev.snoozed.map((e) =>
            e.id === emailId
              ? { ...e, snoozeUntil: snoozeUntil.toISOString() }
              : e,
          );
        } else {
          // Move to snoozed column
          newState.snoozed = [
            ...(prev.snoozed || []),
            {
              ...emailToSnooze,
              status: "snoozed",
              snoozeUntil: snoozeUntil.toISOString(),
            },
          ];
        }

        return newState;
      });

      setSnoozeEmailId(null);
    } catch (error) {
      console.error("Failed to snooze email:", error);
    }
  };

  // Handle custom snooze
  const handleCustomSnooze = () => {
    if (!customSnoozeModal || !customSnoozeDate || !customSnoozeTime) {
      alert("Please select both date and time");
      return;
    }

    const combinedDateTime = new Date(
      `${customSnoozeDate}T${customSnoozeTime}`,
    );

    if (isNaN(combinedDateTime.getTime())) {
      alert("Invalid date or time");
      return;
    }

    if (combinedDateTime <= new Date()) {
      alert("Please select a future date and time");
      return;
    }

    handleSnooze(customSnoozeModal.emailId, combinedDateTime);
    setCustomSnoozeModal(null);
    setCustomSnoozeDate("");
    setCustomSnoozeTime("");
  };

  // Email card component
  const EmailCard: React.FC<{ email: Email }> = ({ email }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(email)}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-move hover:shadow-md transition-shadow"
      onClick={() => onSelectEmail(email)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 truncate">
              {email.from.name || email.from.email}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
            {email.subject || "(No Subject)"}
          </h3>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSnoozeEmailId(snoozeEmailId === email.id ? null : email.id);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>

          {snoozeEmailId === email.id && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
              <div className="p-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 1);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 1 hour
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 4);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 4 hours
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 24);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 1 day
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSnooze(email.id, 72);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  Snooze 3 days
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomSnoozeModal({ emailId: email.id, show: true });
                    setSnoozeEmailId(null);
                    // Set default to tomorrow at 9 AM
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    setCustomSnoozeDate(tomorrow.toISOString().split("T")[0]);
                    setCustomSnoozeTime("09:00");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded border-t border-gray-200 mt-1 pt-2"
                >
                  Custom...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {onGenerateSummary && (
        <div className="mb-2">
          {generatingIds.has(email.id) ? (
            <div className="flex items-center gap-2 text-xs text-blue-600 p-2 bg-blue-50 rounded">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : email.summary ? (
            <div className="p-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span className="text-xs font-semibold text-purple-700">
                  AI Summary
                </span>
              </div>
              <p className="text-xs text-gray-700">{email.summary}</p>
            </div>
          ) : (
            <button
              onClick={(e) => handleGenerateSummary(e, email.id)}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium p-2 hover:bg-purple-50 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Summary</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatDistanceToNow(new Date(email.timestamp))} ago</span>
        {email.gmailLink && (
          <a
            href={email.gmailLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
          >
            <ExternalLink className="w-3 h-3" />
            Gmail
          </a>
        )}
      </div>

      {email.snoozeUntil && email.status === "snoozed" && (
        <div className="mt-2 text-xs text-purple-600 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Until {new Date(email.snoozeUntil).toLocaleString()}
        </div>
      )}
    </div>
  );

  // F3: Apply filters and sorting to emails in a column
  const getFilteredAndSortedEmails = (emails: Email[]): Email[] => {
    let filtered = [...emails];

    // Apply filters
    if (filterUnread) {
      filtered = filtered.filter((email) => !email.isRead);
    }

    if (filterAttachments) {
      filtered = filtered.filter(
        (email) => email.attachments && email.attachments.length > 0,
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();

      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Kanban board...</p>
        </div>
      </div>
    );
  }

  // Check if all columns are empty
  const allEmailsCount = Object.values(emailsByStatus).reduce(
    (sum, emails) => sum + emails.length,
    0,
  );
  const isEmpty = !loading && allEmailsCount === 0;

  const handleSyncFromGmail = async () => {
    if (!mailboxId) {
      alert("No mailbox selected. Please select a mailbox to sync.");
      return;
    }

    try {
      setLoading(true);
      // Fetch inbox emails first to populate the board
      await emailsAPI.fetchMailboxEmails(mailboxId, 1, 50);
      // Refresh the board
      await fetchEmailsByStatus();
    } catch (error) {
      console.error("Failed to sync from Gmail:", error);
      alert("Failed to sync emails. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {/* F3: Filter & Sort Controls */}
          <div className="flex items-center gap-4">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <div className="relative">
                <button
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent flex items-center gap-2 min-w-[140px] justify-between"
                >
                  <span className="font-medium text-gray-700">
                    {sortBy === "newest"
                      ? "Date: Newest First"
                      : "Date: Oldest First"}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${sortDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {sortDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSortDropdownOpen(false)}
                    />
                    <div className="absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-full">
                      <button
                        onClick={() => {
                          setSortBy("newest");
                          setSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          sortBy === "newest"
                            ? "bg-primary-50 text-primary-700 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Date: Newest First
                      </button>
                      <button
                        onClick={() => {
                          setSortBy("oldest");
                          setSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          sortBy === "oldest"
                            ? "bg-primary-50 text-primary-700 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Date: Oldest First
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => setFilterUnread(!filterUnread)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filterUnread
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Unread Only
              </button>
              <button
                onClick={() => setFilterAttachments(!filterAttachments)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filterAttachments
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Has Attachments
              </button>

              {/* Clear Filters */}
              {(filterUnread || filterAttachments) && (
                <button
                  onClick={() => {
                    setFilterUnread(false);
                    setFilterAttachments(false);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {!loading && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                Configure
              </button>
              <button
                onClick={fetchEmailsByStatus}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="flex items-center justify-center h-[calc(100%-80px)]">
          <div className="text-center max-w-md p-8">
            <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Emails Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Load your emails from Gmail to start organizing them in the Kanban
              board workflow.
            </p>
            <button
              onClick={handleSyncFromGmail}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-flex items-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Load from Gmail
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="flex gap-4 p-4 h-[calc(100%-80px)]">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col flex-1 bg-gray-100 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(column.status, e)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`${column.color} text-white p-2 rounded-lg`}>
                  {column.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {column.title}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {(() => {
                      const filtered = getFilteredAndSortedEmails(
                        emailsByStatus[column.status],
                      );
                      const total = emailsByStatus[column.status].length;
                      return filtered.length !== total
                        ? `${filtered.length} of ${total} emails`
                        : `${total} emails`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Email Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin">
                {(() => {
                  // F3: Apply filters and sorting
                  const filteredSortedEmails = getFilteredAndSortedEmails(
                    emailsByStatus[column.status],
                  );

                  return filteredSortedEmails.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      {emailsByStatus[column.status].length === 0
                        ? "No emails in this column"
                        : "No emails match current filters"}
                    </div>
                  ) : (
                    filteredSortedEmails.map((email) => (
                      <EmailCard key={email.id} email={email} />
                    ))
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Settings Modal */}
      <KanbanSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onConfigUpdated={handleConfigUpdated}
      />

      {/* Custom Snooze Modal */}
      {customSnoozeModal?.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Custom Snooze</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose when you want this email to return
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={customSnoozeDate}
                  onChange={(e) => setCustomSnoozeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={customSnoozeTime}
                  onChange={(e) => setCustomSnoozeTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {customSnoozeDate && customSnoozeTime && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  Email will return on{" "}
                  {new Date(
                    `${customSnoozeDate}T${customSnoozeTime}`,
                  ).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setCustomSnoozeModal(null);
                  setCustomSnoozeDate("");
                  setCustomSnoozeTime("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomSnooze}
                disabled={!customSnoozeDate || !customSnoozeTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Snooze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
