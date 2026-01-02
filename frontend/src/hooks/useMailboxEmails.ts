import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/axios';
import { cacheService } from '../services/cacheService';
import type { Email } from '../types';
import { useOnlineStatus } from './useOnlineStatus';

export const useMailboxEmails = (mailboxId: string | null) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();

  const fetchEmails = useCallback(async () => {
    if (!mailboxId) return;

    setLoading(true);
    try {
      // 1. Load from cache
      const cachedEmails = await cacheService.getEmailsByMailbox(mailboxId);
      // Sort by timestamp desc if needed, but usually backend does it.
      // Let's assume backend order is correct, but cached might be mixed?
      // Usually we just trust the cache order or sort it.
      // Let's sort by timestamp desc to be safe.
      cachedEmails.sort((a: Email, b: Email) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (cachedEmails.length > 0) {
        setEmails(cachedEmails);
      }

      // 2. Fetch from network if online
      if (isOnline) {
        const response = await apiClient.get(`/mailboxes/${mailboxId}/emails`);
        const freshEmails = response.data.data || response.data;
        
        setEmails(freshEmails);
        await cacheService.saveEmails(freshEmails);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [mailboxId, isOnline]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  return { emails, setEmails, loading, error, refresh: fetchEmails };
};
