import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/dashboard/Sidebar";
import apiClient from "../api/axios";
import type { Mailbox, Email } from "../types";
import EmailDetail from "../components/dashboard/EmailDetail";
import EmailList from "../components/dashboard/EmailList";
import ComposeEmail from "../components/dashboard/ComposeEmail";
import KanbanBoard, { type KanbanBoardRef } from "../components/dashboard/KanbanBoard";
import SearchResults from "../components/dashboard/SearchResults";
import SearchBar from "../components/dashboard/SearchBar";
import { LayoutGrid, List } from "lucide-react";
import { semanticSearch, fetchEmailById } from "../api/emails.api";
import { useSocket } from "../contexts/SocketContext";
import toast, { Toaster } from "react-hot-toast";
import { useMailboxes } from "../hooks/useMailboxes";
import { useMailboxEmails } from "../hooks/useMailboxEmails";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { cacheService } from "../services/cacheService";
import {
  useKeyboardShortcuts,
  type KeyboardActions,
  type ShortcutContext,
} from "../hooks/useKeyboardShortcuts";
import KeyboardHelpOverlay from "../components/dashboard/KeyboardHelpOverlay";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const isOnline = useOnlineStatus();
  const kanbanRef = useRef<KanbanBoardRef>(null);

  const { mailboxes, loading: mailboxesLoading } = useMailboxes();
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const {
    emails,
    setEmails,
    loading: emailsLoading,
    loadingMore,
    hasMore,
    refresh: refreshEmails,
    loadMore,
  } = useMailboxEmails(selectedMailbox?.id || null);

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban"); // Default to kanban
  const [composeMode, setComposeMode] = useState<{
    replyTo?: Email;
    replyAll?: boolean;
    forward?: boolean;
  }>({});

  // F2: Search state
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Keyboard Navigation
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeZone, setActiveZone] = useState<ShortcutContext>("list");

  // Select Inbox by default when mailboxes are loaded
  useEffect(() => {
    if (mailboxes.length > 0 && !selectedMailbox) {
      const inbox = mailboxes.find((mb: Mailbox) => mb.name === "Inbox");
      if (inbox) {
        setSelectedMailbox(inbox);
      }
    }
  }, [mailboxes, selectedMailbox]);

  // Listen for new emails via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleNewEmail = (newEmail: Email) => {
      // Show toast notification
      toast.success(
        `New email from ${newEmail.from.name || newEmail.from.email}: ${newEmail.subject}`,
        {
          duration: 5000,
          position: "top-right",
        },
      );

      // Update list view: If we are viewing the mailbox where the email belongs
      if (selectedMailbox?.name === newEmail.mailboxId) {
        setEmails((prevEmails) => {
          // Check if email already exists to avoid duplicates
          if (prevEmails.some((e) => e.id === newEmail.id)) {
            return prevEmails;
          }
          const newEmails = [newEmail, ...prevEmails];
          // Update cache
          cacheService.saveEmails(newEmails);
          return newEmails;
        });
      }

      // Update kanban view: Add email to appropriate column
      if (viewMode === "kanban" && kanbanRef.current) {
        kanbanRef.current.addNewEmail(newEmail);
      }
    };

    socket.on("email:new", handleNewEmail);

    return () => {
      socket.off("email:new", handleNewEmail);
    };
  }, [socket, selectedMailbox, setEmails, viewMode]);

  const handleMailboxSelect = (mailbox: Mailbox) => {
    setSelectedMailbox(mailbox);
  };

  const handleEmailSelect = async (email: Email) => {
    try {
      // Try cache first
      const cachedEmail = await cacheService.getEmail(email.id);
      if (cachedEmail) {
        setSelectedEmail(cachedEmail);
      } else {
        setSelectedEmail(email);
      }

      if (isOnline) {
        // Fetch full email details
        const response = await apiClient.get(`/emails/${email.id}`);
        const emailData = response.data.data || response.data;
        setSelectedEmail(emailData);
        await cacheService.saveEmail(emailData);

        // Mark as read if unread
        if (!email.isRead) {
          await apiClient.patch(`/emails/${email.id}`, { isRead: true });
          // Update local state
          setEmails(
            emails.map((e) => (e.id === email.id ? { ...e, isRead: true } : e)),
          );
          // Update cache
          await cacheService.saveEmail({ ...emailData, isRead: true });
        }
      }
    } catch (error) {
      console.error("Failed to fetch email details:", error);
    }
  };

  const handleToggleStar = async (emailId: string) => {
    const email = emails.find((e) => e.id === emailId);
    if (!email) return;

    try {
      await apiClient.patch(`/emails/${emailId}`, {
        isStarred: !email.isStarred,
      });
      // Update local state
      setEmails(
        emails.map((e) =>
          e.id === emailId ? { ...e, isStarred: !e.isStarred } : e,
        ),
      );
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({
          ...selectedEmail,
          isStarred: !selectedEmail.isStarred,
        });
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      await apiClient.delete(`/emails/${emailId}`);
      // Remove from list
      setEmails(emails.filter((e) => e.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Failed to delete email:", error);
    }
  };

  const handleMarkAsRead = async (emailIds: string[], isRead: boolean) => {
    try {
      await Promise.all(
        emailIds.map((id) => apiClient.patch(`/emails/${id}`, { isRead })),
      );
      // Update local state
      setEmails(
        emails.map((e) => (emailIds.includes(e.id) ? { ...e, isRead } : e)),
      );
    } catch (error) {
      console.error("Failed to mark emails:", error);
    }
  };

  const handleRefresh = () => {
    refreshEmails();
  };

  // F2: Handle search (both fuzzy and semantic)
  const handleSearch = async (query: string, isSemanticSearch: boolean) => {
    if (!query.trim()) return;

    setSearchMode(true);
    setSearchLoading(true);
    setSearchError(null);
    setSearchQuery(query);

    try {
      let results: Email[];
      if (isSemanticSearch) {
        // Use semantic search
        results = await semanticSearch(query, 20);
      } else {
        // Use fuzzy search
        const response = await apiClient.get(
          `/search?q=${encodeURIComponent(query)}`,
        );
        results = response.data.data || [];
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      const errorMessage =
        error instanceof Error && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setSearchError(errorMessage || "Failed to search emails");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCloseSearch = () => {
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  const handleCompose = () => {
    setComposeMode({});
    setComposeOpen(true);
  };

  const handleReply = (email: Email, replyAll: boolean = false) => {
    setComposeMode({ replyTo: email, replyAll });
    setComposeOpen(true);
  };

  const handleForward = (email: Email) => {
    setComposeMode({ replyTo: email, forward: true });
    setComposeOpen(true);
  };

  const handleEmailSent = async () => {
    // Refresh emails after sending
    handleRefresh();

    // If replying to a selected email, refresh it to show the updated thread
    if (selectedEmail && composeMode.replyTo) {
      try {
        const updatedEmail = await fetchEmailById(selectedEmail.id);
        setSelectedEmail(updatedEmail);
      } catch (error) {
        console.error("Failed to refresh email after reply:", error);
      }
    }
  };

  const handleEmailUpdate = (updatedEmail: Email) => {
    // Update email in the list
    setEmails(emails.map((e) => (e.id === updatedEmail.id ? updatedEmail : e)));
    // Update selected email if it's the same one
    if (selectedEmail?.id === updatedEmail.id) {
      setSelectedEmail(updatedEmail);
    }
  };

  const handleGenerateSummary = async (
    emailId: string,
  ): Promise<string | null> => {
    try {
      const response = await apiClient.post(`/emails/${emailId}/summarize`);

      if (response.data.success) {
        const newSummary = response.data.data.summary;

        // Update email in the list with new summary
        setEmails(
          emails.map((e) =>
            e.id === emailId ? { ...e, summary: newSummary } : e,
          ),
        );

        // Update selected email if it's the same one
        if (selectedEmail?.id === emailId) {
          setSelectedEmail({ ...selectedEmail, summary: newSummary });
        }

        return newSummary; // Return summary for KanbanBoard to use
      }
      return null;
    } catch (error) {
      console.error("Failed to generate summary:", error);
      const errorMessage =
        error instanceof Error && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      alert(errorMessage || "Failed to generate summary. Please try again.");
      return null;
    }
  };

  // Update active zone based on selection
  useEffect(() => {
    if (!selectedEmail) {
      setActiveZone("list");
    }
  }, [selectedEmail]);

  const handleKeyboardActions: KeyboardActions = {
    nextItem: () => {
      if (!emails.length) return;
      const currentIndex = selectedEmail
        ? emails.findIndex((e) => e.id === selectedEmail.id)
        : -1;
      const nextIndex = Math.min(emails.length - 1, currentIndex + 1);
      if (nextIndex !== currentIndex) {
        handleEmailSelect(emails[nextIndex]);
      }
    },
    prevItem: () => {
      if (!emails.length) return;
      const currentIndex = selectedEmail
        ? emails.findIndex((e) => e.id === selectedEmail.id)
        : -1;
      if (currentIndex === -1) {
        handleEmailSelect(emails[0]);
        return;
      }
      const prevIndex = Math.max(0, currentIndex - 1);
      if (prevIndex !== currentIndex) {
        handleEmailSelect(emails[prevIndex]);
      }
    },
    openItem: () => {
      if (selectedEmail) {
        setActiveZone("message");
      } else if (emails.length > 0) {
        handleEmailSelect(emails[0]);
        setActiveZone("message");
      }
    },
    goBack: () => {
      if (activeZone === "message") {
        setActiveZone("list");
      } else {
        setSelectedEmail(null);
      }
    },
    delete: () => {
      if (selectedEmail) handleDeleteEmail(selectedEmail.id);
    },
    archive: () => {
      // Implement archive if available
    },
    reply: () => {
      if (selectedEmail) handleReply(selectedEmail);
    },
    replyAll: () => {
      if (selectedEmail) handleReply(selectedEmail, true);
    },
    forward: () => {
      if (selectedEmail) handleForward(selectedEmail);
    },
    markRead: () => {
      if (selectedEmail) handleMarkAsRead([selectedEmail.id], true);
    },
    markUnread: () => {
      if (selectedEmail) handleMarkAsRead([selectedEmail.id], false);
    },
    star: () => {
      if (selectedEmail) handleToggleStar(selectedEmail.id);
    },
    goToInbox: () => {
      const inbox = mailboxes.find((mb) => mb.name === "INBOX");
      if (inbox) handleMailboxSelect(inbox);
    },
    goToSent: () => {
      const sent = mailboxes.find((mb) => mb.name === "SENT");
      if (sent) handleMailboxSelect(sent);
    },
    goToDrafts: () => {
      const drafts = mailboxes.find((mb) => mb.name === "DRAFTS");
      if (drafts) handleMailboxSelect(drafts);
    },
    search: () => {
      const searchInput = document.querySelector(
        'input[placeholder="Search emails..."]',
      ) as HTMLInputElement;
      if (searchInput) searchInput.focus();
    },
    showHelp: () => setShowShortcuts(true),
  };

  useKeyboardShortcuts(
    handleKeyboardActions,
    activeZone,
    !composeOpen && !showShortcuts,
  );

  if (mailboxesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toaster />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mail Dashboard</h1>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* F2: Integrated Search Bar with Auto-Suggestions */}
          <SearchBar
            onSearch={handleSearch}
            loading={searchLoading}
            placeholder="Search emails..."
          />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 bg-gray-100 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {!isOnline && (
        <div
          className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4"
          role="alert"
        >
          <p className="font-bold">Offline Mode</p>
          <p>You are currently offline. Some features may be unavailable.</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {searchMode ? (
          /* F2: Search Results View */
          <>
            <SearchResults
              query={searchQuery}
              results={searchResults}
              loading={searchLoading}
              error={searchError}
              onSelectEmail={handleEmailSelect}
              onClose={handleCloseSearch}
            />

            {/* Email Detail Panel */}
            <EmailDetail
              email={selectedEmail}
              onToggleStar={handleToggleStar}
              onDelete={handleDeleteEmail}
              onReply={handleReply}
              onForward={handleForward}
              onEmailUpdate={handleEmailUpdate}
            />
          </>
        ) : viewMode === "kanban" ? (
          /* Kanban View - Full Width - Shows all emails by status */
          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              ref={kanbanRef}
              mailboxId={selectedMailbox?.id}
              onSelectEmail={handleEmailSelect}
              onGenerateSummary={handleGenerateSummary}
            />
          </div>
        ) : (
          /* Traditional List View - 3 Column Layout */
          <>
            {/* Column 1: Mailboxes (~20%) */}
            <Sidebar
              mailboxes={mailboxes}
              selectedMailbox={selectedMailbox}
              onSelectMailbox={handleMailboxSelect}
            />

            {/* Column 2: Email List (~40%) */}
            <div
              className="flex-1 flex flex-col min-w-0"
              onClick={() => setActiveZone("list")}
            >
              <EmailList
                emails={emails}
                loading={emailsLoading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                selectedEmail={selectedEmail}
                onSelectEmail={handleEmailSelect}
                onToggleStar={handleToggleStar}
                onDelete={handleDeleteEmail}
                onMarkAsRead={handleMarkAsRead}
                onRefresh={handleRefresh}
                onCompose={handleCompose}
                onLoadMore={loadMore}
                onGenerateSummary={handleGenerateSummary}
              />
            </div>

            {/* Column 3: Email Detail (~40%) */}
            <div
              className="flex-1 flex flex-col min-w-0"
              onClick={() => setActiveZone("message")}
            >
              <EmailDetail
                email={selectedEmail}
                onToggleStar={handleToggleStar}
                onDelete={handleDeleteEmail}
                onReply={handleReply}
                onForward={handleForward}
                onEmailUpdate={handleEmailUpdate}
              />
            </div>
          </>
        )}
      </div>

      {/* Compose Email Modal */}
      <ComposeEmail
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={handleEmailSent}
        replyTo={composeMode.replyTo}
        replyAll={composeMode.replyAll}
        forward={composeMode.forward}
      />

      {/* Email Detail Modal for Kanban View (not in search mode) */}
      {viewMode === "kanban" && !searchMode && selectedEmail && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEmail(null)}
        >
          <div
            className="flex flex-col bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <EmailDetail
              email={selectedEmail}
              onToggleStar={handleToggleStar}
              onDelete={handleDeleteEmail}
              onReply={handleReply}
              onForward={handleForward}
              onEmailUpdate={handleEmailUpdate}
            />
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toaster position="top-right" reverseOrder={false} />

      <KeyboardHelpOverlay
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
};

export default Dashboard;
