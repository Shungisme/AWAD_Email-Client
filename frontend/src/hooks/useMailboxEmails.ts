import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/axios';
import { cacheService } from '../services/cacheService';
import type { Email } from '../types';
import { useOnlineStatus } from './useOnlineStatus';

const PAGE_SIZE = 10;

export const useMailboxEmails = (mailboxId: string | null) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isOnline = useOnlineStatus();
  
  // Use ref to store nextPageToken to avoid re-renders
  const nextPageTokenRef = useRef<string | null>(null);

  const fetchEmails = useCallback(async (isLoadMore: boolean = false) => {
    if (!mailboxId) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      // Load from cache only for first load
      if (!isLoadMore) {
        const cachedEmails = await cacheService.getEmailsByMailbox(mailboxId);
        cachedEmails.sort((a: Email, b: Email) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (cachedEmails.length > 0) {
          setEmails(cachedEmails);
        }
      }

      // Fetch from network if online
      if (isOnline) {
        // Build params - use pageToken for subsequent requests (Gmail), page number for mock data
        const params: Record<string, string | number> = { limit: PAGE_SIZE };
        
        if (isLoadMore && nextPageTokenRef.current) {
          // Use pageToken for Gmail pagination
          params.pageToken = nextPageTokenRef.current;
        } else if (!isLoadMore) {
          // Reset pageToken on fresh fetch
          nextPageTokenRef.current = null;
        }

        const response = await apiClient.get(`/mailboxes/${mailboxId}/emails`, { params });
        
        const freshEmails = response.data.data || response.data;
        const pagination = response.data.pagination;
        
        if (isLoadMore) {
          setEmails(prev => {
            // Avoid duplicates when appending
            const existingIds = new Set(prev.map(e => e.id));
            const newEmails = freshEmails.filter((e: Email) => !existingIds.has(e.id));
            const combined = [...prev, ...newEmails];
            // Update cache with combined emails
            cacheService.saveEmails(combined);
            return combined;
          });
        } else {
          setEmails(freshEmails);
          await cacheService.saveEmails(freshEmails);
        }

        // Store nextPageToken for subsequent requests
        if (pagination?.nextPageToken) {
          nextPageTokenRef.current = pagination.nextPageToken;
          setHasMore(true);
        } else {
          nextPageTokenRef.current = null;
          // For mock data without pageToken, check if we got fewer results than requested
          setHasMore(freshEmails.length >= PAGE_SIZE);
        }
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [mailboxId, isOnline]);

  // Load more emails (next page)
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchEmails(true);
    }
  }, [fetchEmails, loadingMore, hasMore]);

  // Refresh (reset to first page)
  const refresh = useCallback(() => {
    nextPageTokenRef.current = null;
    setHasMore(true);
    fetchEmails(false);
  }, [fetchEmails]);

  // Reset when mailbox changes
  useEffect(() => {
    nextPageTokenRef.current = null;
    setHasMore(true);
    setEmails([]);
    fetchEmails(false);
  }, [mailboxId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { 
    emails, 
    setEmails, 
    loading, 
    loadingMore,
    error, 
    refresh,
    loadMore,
    hasMore
  };
};
