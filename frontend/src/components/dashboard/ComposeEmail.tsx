import React, { useState, useEffect } from "react";
import { X, Send, Paperclip } from "lucide-react";
import apiClient from "../../api/axios";
import type { Email, EmailAddress } from "../../types";

interface ComposeEmailProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  replyTo?: Email;
  replyAll?: boolean;
  forward?: boolean;
}

const ComposeEmail: React.FC<ComposeEmailProps> = ({
  isOpen,
  onClose,
  onSent,
  replyTo,
  replyAll,
  forward,
}) => {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill form for reply/forward
  useEffect(() => {
    if (replyTo) {
      if (forward) {
        // Forward: empty recipients, keep subject with Fwd:, include original body
        setTo("");
        setCc("");
        setSubject(`Fwd: ${replyTo.subject}`);
        setBody(
          `\n\n---------- Forwarded message ---------\nFrom: ${replyTo.from.name} <${replyTo.from.email}>\nDate: ${replyTo.timestamp}\nSubject: ${replyTo.subject}\n\n${replyTo.body}`
        );
      } else {
        // Reply or Reply All
        const recipients = replyAll
          ? [
              replyTo.from.email,
              ...replyTo.to
                .map((t) => t.email)
                .filter((email) => email !== replyTo.from.email),
            ].join(", ")
          : replyTo.from.email;

        setTo(recipients);

        if (replyAll && replyTo.cc.length > 0) {
          setCc(replyTo.cc.map((c) => c.email).join(", "));
        }

        setSubject(
          replyTo.subject.startsWith("Re:")
            ? replyTo.subject
            : `Re: ${replyTo.subject}`
        );
        setBody(
          `\n\n\nOn ${replyTo.timestamp}, ${
            replyTo.from.name
          } wrote:\n> ${replyTo.body.replace(/\n/g, "\n> ")}`
        );
      }
    }
  }, [replyTo, replyAll, forward]);

  const handleSend = async () => {
    if (!to.trim()) {
      setError("Please enter at least one recipient");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    setSending(true);
    setError("");

    try {
      const toAddresses: EmailAddress[] = to
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email)
        .map((email) => ({
          name: email.split("@")[0],
          email,
        }));

      const ccAddresses: EmailAddress[] = cc
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email)
        .map((email) => ({
          name: email.split("@")[0],
          email,
        }));

      await apiClient.post("/emails/send", {
        to: toAddresses,
        cc: ccAddresses.length > 0 ? ccAddresses : undefined,
        subject,
        body,
        inReplyTo: replyTo && !forward ? replyTo.id : undefined,
      });

      // Success
      onSent?.();
      onClose();
      // Reset form
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
    } catch (err: any) {
      console.error("Send email error:", err);
      setError(
        err.response?.data?.message || "Failed to send email. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {forward
              ? "Forward Email"
              : replyTo
              ? replyAll
                ? "Reply All"
                : "Reply"
              : "New Email"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={sending}
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple recipients with commas
            </p>
          </div>

          {/* Cc */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cc
            </label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={sending}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={sending}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={sending}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={sending}
          >
            <Paperclip className="w-4 h-4" />
            <span className="text-sm">Attach files (Coming soon)</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeEmail;
