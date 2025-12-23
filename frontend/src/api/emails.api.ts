/**
 * Emails API
 * Handles all email-related API calls
 */

import apiClient from "./axios";
import type { Email, EmailStatus, EmailAddress } from "../types";

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// Pagination response
interface PaginationResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
    nextPageToken?: string;
  };
}

// Email send request
export interface SendEmailRequest {
  to: EmailAddress[];
  subject: string;
  body: string;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  inReplyTo?: string;
  attachments?: File[];
}

// Bulk action request
export interface BulkActionRequest {
  emailIds: string[];
  action: "read" | "unread" | "star" | "unstar" | "delete" | "archive";
  value?: boolean;
}

// Snooze request
export interface SnoozeEmailRequest {
  snoozeUntil: string; // ISO date string
}

// Send email response
export interface SendEmailResponse {
  success: boolean;
  message: string;
  data?: {
    id?: string;
    threadId?: string;
    labelIds?: string[];
  };
}

// Bulk action response
export interface BulkActionResponse {
  success: boolean;
  message: string;
}

/**
 * Get emails for a specific mailbox with pagination
 */
export const fetchMailboxEmails = async (
  mailboxId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginationResponse<Email>> => {
  const response = await apiClient.get<PaginationResponse<Email>>(
    `/mailboxes/${mailboxId}/emails`,
    {
      params: { page, limit },
    }
  );
  return response.data;
};

/**
 * Get a specific email by ID
 */
export const fetchEmailById = async (emailId: string): Promise<Email> => {
  const response = await apiClient.get<ApiResponse<Email>>(
    `/emails/${emailId}`
  );
  return response.data.data!;
};

/**
 * Update email properties (isRead, isStarred)
 */
export const updateEmail = async (
  emailId: string,
  updates: {
    isRead?: boolean;
    isStarred?: boolean;
  }
): Promise<Email> => {
  const response = await apiClient.patch<ApiResponse<Email>>(
    `/emails/${emailId}`,
    updates
  );
  return response.data.data!;
};

/**
 * Update email status (for Kanban board)
 */
export const updateEmailStatus = async (
  emailId: string,
  status: EmailStatus
): Promise<Email> => {
  const response = await apiClient.patch<ApiResponse<Email>>(
    `/emails/${emailId}/status`,
    { status }
  );
  return response.data.data!;
};

/**
 * Send a new email
 */
export const sendEmail = async (
  emailData: SendEmailRequest
): Promise<SendEmailResponse> => {
  const response = await apiClient.post<SendEmailResponse>(
    "/emails/send",
    emailData
  );
  return response.data;
};

/**
 * Delete an email (move to trash)
 */
export const deleteEmail = async (emailId: string): Promise<void> => {
  await apiClient.delete(`/emails/${emailId}`);
};

/**
 * Perform bulk actions on multiple emails
 */
export const bulkActionEmails = async (
  actionData: BulkActionRequest
): Promise<BulkActionResponse> => {
  const response = await apiClient.post<BulkActionResponse>(
    "/emails/bulk-action",
    actionData
  );
  return response.data;
};

/**
 * Search emails
 */
export const searchEmails = async (
  query: string,
  filters?: {
    mailboxId?: string;
    isRead?: boolean;
    isStarred?: boolean;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Email[]> => {
  const response = await apiClient.get<ApiResponse<Email[]>>("/emails/search", {
    params: { q: query, ...filters },
  });
  return response.data.data || [];
};

/**
 * Get emails by status (for Kanban board)
 */
export const fetchEmailsByStatus = async (
  status: EmailStatus
): Promise<Email[]> => {
  const response = await apiClient.get<ApiResponse<Email[]>>(
    `/emails/by-status/${status}`
  );
  return response.data.data || [];
};

/**
 * Snooze an email until a specific time
 */
export const snoozeEmail = async (
  emailId: string,
  snoozeData: SnoozeEmailRequest
): Promise<Email> => {
  const response = await apiClient.post<ApiResponse<Email>>(
    `/emails/${emailId}/snooze`,
    snoozeData
  );
  return response.data.data!;
};

/**
 * Generate AI summary for a single email
 */
export const generateEmailSummary = async (
  emailId: string
): Promise<{ summary: string }> => {
  const response = await apiClient.post<ApiResponse<{ summary: string }>>(
    `/emails/${emailId}/summarize`
  );
  return response.data.data!;
};

/**
 * Generate AI summaries for multiple emails in batch
 */
export const batchSummarizeEmails = async (
  emailIds: string[]
): Promise<Array<{ id: string; summary: string }>> => {
  const response = await apiClient.post<
    ApiResponse<Array<{ id: string; summary: string }>>
  >("/emails/batch-summarize", { emailIds });
  return response.data.data || [];
};

/**
 * Archive an email
 */
export const archiveEmail = async (emailId: string): Promise<void> => {
  await apiClient.post(`/emails/${emailId}/archive`);
};

/**
 * Unarchive an email
 */
export const unarchiveEmail = async (emailId: string): Promise<void> => {
  await apiClient.post(`/emails/${emailId}/unarchive`);
};

/**
 * Mark email as spam
 */
export const markAsSpam = async (emailId: string): Promise<void> => {
  await apiClient.post(`/emails/${emailId}/spam`);
};

/**
 * Move email to a different mailbox
 */
export const moveEmail = async (
  emailId: string,
  targetMailboxId: string
): Promise<Email> => {
  const response = await apiClient.post<ApiResponse<Email>>(
    `/emails/${emailId}/move`,
    { mailboxId: targetMailboxId }
  );
  return response.data.data!;
};

/**
 * Download email attachment
 */
export const downloadAttachment = async (
  emailId: string,
  attachmentId: string
): Promise<Blob> => {
  const response = await apiClient.get(
    `/emails/${emailId}/attachments/${attachmentId}`,
    {
      responseType: "blob",
    }
  );
  return response.data;
};

/**
 * Get email thread/conversation
 */
export const fetchEmailThread = async (threadId: string): Promise<Email[]> => {
  const response = await apiClient.get<ApiResponse<Email[]>>(
    `/emails/thread/${threadId}`
  );
  return response.data.data || [];
};

/**
 * Semantic search for emails using vector embeddings
 */
export const semanticSearch = async (
  query: string,
  limit: number = 20
): Promise<Email[]> => {
  const response = await apiClient.post<ApiResponse<Email[]>>(
    "/search/semantic",
    { query, limit }
  );
  return response.data.data || [];
};

/**
 * Get search suggestions for auto-complete
 */
export const getSearchSuggestions = async (
  query: string
): Promise<string[]> => {
  const response = await apiClient.get<ApiResponse<string[]>>(
    "/search/suggestions",
    { params: { q: query } }
  );
  return response.data.data || [];
};
