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
} from "lucide-react";
import type { Email, EmailStatus } from "../../types";
import * as emailsAPI from "../../api/emails.api";

interface KanbanBoardProps {
  mailboxId?: string; // Optional - Kanban shows all emails by status
  onSelectEmail: (email: Email) => void;
  onGenerateSummary?: (emailId: string) => Promise<string | null>; // Returns summary
}

interface Column {
  id: EmailStatus;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const columns: Column[] = [
  {
    id: "inbox",
    title: "Inbox",
    icon: <Inbox className="w-5 h-5" />,
    color: "bg-blue-500",
  },
  {
    id: "todo",
    title: "To Do",
    icon: <Clock className="w-5 h-5" />,
    color: "bg-yellow-500",
  },
  {
    id: "done",
    title: "Done",
    icon: <CheckCircle className="w-5 h-5" />,
    color: "bg-green-500",
  },
  {
    id: "snoozed",
    title: "Snoozed",
    icon: <Clock className="w-5 h-5" />,
    color: "bg-purple-500",
  },
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  mailboxId,
  onSelectEmail,
  onGenerateSummary,
}) => {
  const [emailsByStatus, setEmailsByStatus] = useState<
    Record<EmailStatus, Email[]>
  >({
    inbox: [],
    todo: [],
    done: [],
    snoozed: [],
  });
  const [loading, setLoading] = useState(true);
  const [draggingEmail, setDraggingEmail] = useState<Email | null>(null);
  const [snoozeEmailId, setSnoozeEmailId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  // Fetch emails grouped by status
  const fetchEmailsByStatus = useCallback(async () => {
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
            error
          );
        }
      }

      // Now fetch emails by status from MongoDB
      const statusPromises = columns.map((col) =>
        emailsAPI.fetchEmailsByStatus(col.id)
      );

      const results = await Promise.all(statusPromises);
      const newEmailsByStatus: Record<EmailStatus, Email[]> = {
        inbox: [],
        todo: [],
        done: [],
        snoozed: [],
      };

      results.forEach((emails, index) => {
        const status = columns[index].id;
        newEmailsByStatus[status] = emails;
      });

      setEmailsByStatus(newEmailsByStatus);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [mailboxId]);

  const handleGenerateSummary = async (
    e: React.MouseEvent,
    emailId: string
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
            updated[status as EmailStatus] = updated[status as EmailStatus].map(
              (email) => (email.id === emailId ? { ...email, summary } : email)
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
  const handleDrop = async (targetStatus: EmailStatus, e: React.DragEvent) => {
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
            (e) => e.id !== draggingEmail.id
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
        await emailsAPI.updateEmailStatus(draggingEmail.id, targetStatus);

        // Update local state
        const sourceStatus = draggingEmail.status;
        setEmailsByStatus((prev) => ({
          ...prev,
          [sourceStatus]: prev[sourceStatus].filter(
            (e) => e.id !== draggingEmail.id
          ),
          [targetStatus]: [
            ...prev[targetStatus],
            { ...draggingEmail, status: targetStatus, snoozeUntil: null },
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
  const handleSnooze = async (emailId: string, hours: number) => {
    try {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);

      await emailsAPI.snoozeEmail(emailId, {
        snoozeUntil: snoozeUntil.toISOString(),
      });

      // Update local state - move email to snoozed column
      setEmailsByStatus((prev) => {
        let emailToSnooze: Email | null = null;
        let sourceStatus: EmailStatus | null = null;

        // Find the email in current columns
        for (const status of [
          "inbox",
          "todo",
          "done",
          "snoozed",
        ] as EmailStatus[]) {
          const found = prev[status].find((e) => e.id === emailId);
          if (found) {
            emailToSnooze = found;
            sourceStatus = status;
            break;
          }
        }

        if (!emailToSnooze || !sourceStatus) return prev;

        // Create new state with email moved to snoozed
        return {
          inbox:
            sourceStatus === "inbox"
              ? prev.inbox.filter((e) => e.id !== emailId)
              : prev.inbox,
          todo:
            sourceStatus === "todo"
              ? prev.todo.filter((e) => e.id !== emailId)
              : prev.todo,
          done:
            sourceStatus === "done"
              ? prev.done.filter((e) => e.id !== emailId)
              : prev.done,
          snoozed:
            sourceStatus === "snoozed"
              ? prev.snoozed.map((e) =>
                  e.id === emailId
                    ? { ...e, snoozeUntil: snoozeUntil.toISOString() }
                    : e
                )
              : [
                  ...prev.snoozed,
                  {
                    ...emailToSnooze,
                    status: "snoozed",
                    snoozeUntil: snoozeUntil.toISOString(),
                  },
                ],
        };
      });

      setSnoozeEmailId(null);
    } catch (error) {
      console.error("Failed to snooze email:", error);
    }
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
              <p className="text-xs text-gray-700 line-clamp-3">
                {email.summary}
              </p>
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
    0
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
          {!loading && (
            <button
              onClick={fetchEmailsByStatus}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
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
              onDrop={(e) => handleDrop(column.id, e)}
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
                    {emailsByStatus[column.id].length} emails
                  </p>
                </div>
              </div>

              {/* Email Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin">
                {emailsByStatus[column.id].length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No emails in this column
                  </div>
                ) : (
                  emailsByStatus[column.id].map((email) => (
                    <EmailCard key={email.id} email={email} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
