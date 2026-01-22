import React, { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  RefreshCw,
  Trash2,
  CheckCircle,
  Circle,
  Star,
  Search,
  Plus,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { Email } from "../../types";

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
  onToggleStar: (emailId: string) => void;
  onDelete: (emailId: string) => void;
  onMarkAsRead: (emailIds: string[], isRead: boolean) => void;
  onRefresh: () => void;
  onCompose: () => void;
  onLoadMore?: () => void;
  onGenerateSummary?: (emailId: string) => Promise<string | null>;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  loadingMore = false,
  hasMore = false,
  selectedEmail,
  onSelectEmail,
  onToggleStar,
  onDelete,
  onMarkAsRead,
  onRefresh,
  onCompose,
  onLoadMore,
  onGenerateSummary,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const selectedEmailRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedEmail && selectedEmailRef.current) {
      selectedEmailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedEmail]);

  // Infinite scroll using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && onLoadMore) {
          onLoadMore();
        }
      },
      { 
        root: listContainerRef.current,
        threshold: 0.1 
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, onLoadMore]);

  const handleGenerateSummary = async (
    e: React.MouseEvent,
    emailId: string,
  ) => {
    e.stopPropagation();
    if (!onGenerateSummary || generatingIds.has(emailId)) return;

    setGeneratingIds((prev) => new Set(prev).add(emailId));
    try {
      await onGenerateSummary(emailId);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === emails.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emails.map((e) => e.id));
    }
  };

  const handleToggleSelect = (emailId: string) => {
    setSelectedIds((prev) =>
      prev.includes(emailId)
        ? prev.filter((id) => id !== emailId)
        : [...prev, emailId],
    );
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => onDelete(id));
    setSelectedIds([]);
  };

  const handleMarkSelectedAsRead = () => {
    onMarkAsRead(selectedIds, true);
    setSelectedIds([]);
  };

  const handleMarkSelectedAsUnread = () => {
    onMarkAsRead(selectedIds, false);
    setSelectedIds([]);
  };

  const filteredEmails = emails.filter(
    (email) =>
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col bg-white border-r border-gray-200 min-w-0 max-h-full">
      {/* Header Actions */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Select All"
            >
              {selectedIds.length === emails.length ? (
                <CheckCircle className="w-5 h-5 text-primary-600" />
              ) : (
                <Circle className="w-5 h-5 text-gray-500" />
              )}
            </button>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-600 ${
                  loading ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedIds.length} selected
              </span>
              <button
                onClick={handleMarkSelectedAsRead}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Mark Read
              </button>
              <button
                onClick={handleMarkSelectedAsUnread}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Mark Unread
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onCompose}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              title="Compose"
            >
              <Plus className="w-4 h-4" />
              Compose
            </button>
          )}
        </div>
      </div>

      {/* Email List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <Mail className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No emails found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? "Try a different search" : "This mailbox is empty"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              const isChecked = selectedIds.includes(email.id);

              return (
                <div
                  key={email.id}
                  ref={isSelected ? selectedEmailRef : null}
                  className={`
                    flex items-start gap-3 p-4 cursor-pointer transition-colors
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                  `}
                  style={{ scrollMarginBlock: "100px" }}
                  onClick={() => onSelectEmail(email)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(email.id);
                    }}
                    className="mt-1"
                  >
                    {isChecked ? (
                      <CheckCircle className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                    )}
                  </button>

                  {/* Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(email.id);
                    }}
                    className="mt-1"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        email.isStarred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300 hover:text-gray-400"
                      }`}
                    />
                  </button>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p
                        className={`text-sm truncate ${
                          email.isRead
                            ? "font-normal text-gray-700"
                            : "font-semibold text-gray-900"
                        }`}
                      >
                        {email.from.name}
                      </p>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatDistanceToNow(new Date(email.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate mb-1 ${
                        email.isRead
                          ? "font-normal text-gray-600"
                          : "font-medium text-gray-900"
                      }`}
                    >
                      {email.subject}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {email.preview}
                    </p>

                    {/* AI Summary Section */}
                    {onGenerateSummary && (
                      <div className="mt-2">
                        {generatingIds.has(email.id) ? (
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Generating summary...</span>
                          </div>
                        ) : email.summary ? (
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-md p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              <span className="text-xs font-semibold text-purple-700">
                                AI Summary
                              </span>
                            </div>
                            <p className="text-xs text-gray-700">
                              {email.summary}
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleGenerateSummary(e, email.id)}
                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>AI Summary</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Infinite scroll observer target */}
            <div ref={observerTarget} className="h-1" />
            
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                <span className="ml-2 text-sm text-gray-500">Loading more emails...</span>
              </div>
            )}
            
            {/* End of list message */}
            {!hasMore && filteredEmails.length > 0 && (
              <div className="text-center py-4 text-sm text-gray-400">
                No more emails to load
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailList;
