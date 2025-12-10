import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "../components/dashboard/Sidebar";
import apiClient from "../api/axios";
import type { Mailbox, Email } from "../types";
import EmailDetail from "../components/dashboard/EmailDetail";
import EmailList from "../components/dashboard/EmailList";
import ComposeEmail from "../components/dashboard/ComposeEmail";
import KanbanBoard from "../components/dashboard/KanbanBoard";
import { LayoutGrid, List } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban"); // Default to kanban
  const [composeMode, setComposeMode] = useState<{
    replyTo?: Email;
    replyAll?: boolean;
    forward?: boolean;
  }>({});

  // Fetch mailboxes on mount
  useEffect(() => {
    const fetchMailboxes = async () => {
      try {
        const response = await apiClient.get("/mailboxes");
        const mailboxesData = response.data.data || response.data;
        setMailboxes(mailboxesData);
        // Select Inbox by default
        const inbox = mailboxesData.find((mb: Mailbox) => mb.name === "Inbox");
        if (inbox) {
          setSelectedMailbox(inbox);
        }
      } catch (error) {
        console.error("Failed to fetch mailboxes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMailboxes();
  }, []);

  // Fetch emails when mailbox changes
  useEffect(() => {
    const fetchEmails = async () => {
      if (!selectedMailbox) return;

      setEmailsLoading(true);
      try {
        const response = await apiClient.get(
          `/mailboxes/${selectedMailbox.id}/emails`
        );
        const emailsData = response.data.data || response.data;
        setEmails(emailsData);
        // Clear selected email when switching mailboxes
        setSelectedEmail(null);
      } catch (error) {
        console.error("Failed to fetch emails:", error);
      } finally {
        setEmailsLoading(false);
      }
    };

    fetchEmails();
  }, [selectedMailbox]);

  const handleMailboxSelect = (mailbox: Mailbox) => {
    setSelectedMailbox(mailbox);
  };

  const handleEmailSelect = async (email: Email) => {
    try {
      // Fetch full email details
      const response = await apiClient.get(`/emails/${email.id}`);
      const emailData = response.data.data || response.data;
      setSelectedEmail(emailData);

      // Mark as read if unread
      if (!email.isRead) {
        await apiClient.patch(`/emails/${email.id}`, { isRead: true });
        // Update local state
        setEmails(
          emails.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
        );
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
          e.id === emailId ? { ...e, isStarred: !e.isStarred } : e
        )
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
        emailIds.map((id) => apiClient.patch(`/emails/${id}`, { isRead }))
      );
      // Update local state
      setEmails(
        emails.map((e) => (emailIds.includes(e.id) ? { ...e, isRead } : e))
      );
    } catch (error) {
      console.error("Failed to mark emails:", error);
    }
  };

  const handleRefresh = () => {
    if (selectedMailbox) {
      setSelectedMailbox({ ...selectedMailbox });
    }
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

  const handleEmailSent = () => {
    // Refresh emails after sending
    handleRefresh();
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
    emailId: string
  ): Promise<string | null> => {
    try {
      const response = await apiClient.post(`/emails/${emailId}/summarize`);

      if (response.data.success) {
        const newSummary = response.data.data.summary;

        // Update email in the list with new summary
        setEmails(
          emails.map((e) =>
            e.id === emailId ? { ...e, summary: newSummary } : e
          )
        );

        // Update selected email if it's the same one
        if (selectedEmail?.id === emailId) {
          setSelectedEmail({ ...selectedEmail, summary: newSummary });
        }

        return newSummary; // Return summary for KanbanBoard to use
      }
      return null;
    } catch (error: any) {
      console.error("Failed to generate summary:", error);
      alert(
        error.response?.data?.message ||
          "Failed to generate summary. Please try again."
      );
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
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
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === "kanban" ? (
          /* Kanban View - Full Width - Shows all emails by status */
          <div className="flex-1 overflow-hidden">
            <KanbanBoard
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
            <EmailList
              emails={emails}
              loading={emailsLoading}
              selectedEmail={selectedEmail}
              onSelectEmail={handleEmailSelect}
              onToggleStar={handleToggleStar}
              onDelete={handleDeleteEmail}
              onMarkAsRead={handleMarkAsRead}
              onRefresh={handleRefresh}
              onCompose={handleCompose}
              onGenerateSummary={handleGenerateSummary}
            />

            {/* Column 3: Email Detail (~40%) */}
            <EmailDetail
              email={selectedEmail}
              onToggleStar={handleToggleStar}
              onDelete={handleDeleteEmail}
              onReply={handleReply}
              onForward={handleForward}
              onEmailUpdate={handleEmailUpdate}
            />
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

      {/* Email Detail Modal for Kanban View */}
      {viewMode === "kanban" && selectedEmail && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEmail(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
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
    </div>
  );
};

export default Dashboard;
