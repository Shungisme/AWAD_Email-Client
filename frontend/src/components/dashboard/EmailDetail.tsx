import React from "react";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Star,
  Paperclip,
  Mail,
  Download,
} from "lucide-react";
import type { Email } from "../../types";
import apiClient from "../../api/axios";

interface EmailDetailProps {
  email: Email | null;
  onToggleStar: (emailId: string) => void;
  onDelete: (emailId: string) => void;
  onReply: (email: Email, replyAll?: boolean) => void;
  onForward: (email: Email) => void;
}

const EmailDetail: React.FC<EmailDetailProps> = ({
  email,
  onToggleStar,
  onDelete,
  onReply,
  onForward,
}) => {
  const handleDownloadAttachment = async (
    attachmentId: string,
    fileName: string
  ) => {
    try {
      const response = await apiClient.get(
        `/emails/${email?.id}/attachments/${attachmentId}`,
        {
          responseType: "blob",
        }
      );

      // Create a blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Failed to download attachment. Please try again.");
    }
  };
  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <Mail className="w-24 h-24 text-gray-300 mb-4" />
        <p className="text-lg font-medium text-gray-600">No email selected</p>
        <p className="text-sm text-gray-400 mt-1">
          Select an email to view its contents
        </p>
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(email.body);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex-1 pr-4">
            {email.subject}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleStar(email.id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={email.isStarred ? "Unstar" : "Star"}
            >
              <Star
                className={`w-5 h-5 ${
                  email.isStarred
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-400"
                }`}
              />
            </button>
            <button
              onClick={() => onDelete(email.id)}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sender Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 font-semibold text-sm">
                {email.from.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {email.from.name}
              </p>
              <p className="text-sm text-gray-600">{email.from.email}</p>
            </div>
            <p className="text-sm text-gray-500 flex-shrink-0">
              {format(new Date(email.timestamp), "MMM d, yyyy h:mm a")}
            </p>
          </div>

          {/* Recipients */}
          <div className="text-sm text-gray-600 pl-13">
            <div className="flex gap-2">
              <span className="font-medium">To:</span>
              <span>{email.to.map((t) => t.email).join(", ")}</span>
            </div>
            {email.cc.length > 0 && (
              <div className="flex gap-2 mt-1">
                <span className="font-medium">Cc:</span>
                <span>{email.cc.map((c) => c.email).join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onReply(email, false)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => onReply(email, true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <ReplyAll className="w-4 h-4" />
            Reply All
          </button>
          <button
            onClick={() => onForward(email)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
      </div>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div className="border-t border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Attachments ({email.attachments.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {email.attachments.map((attachment, index) => (
              <button
                key={index}
                onClick={() =>
                  attachment.id &&
                  handleDownloadAttachment(attachment.id, attachment.name)
                }
                disabled={!attachment.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-gray-500">{attachment.size}</p>
                </div>
                <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailDetail;
