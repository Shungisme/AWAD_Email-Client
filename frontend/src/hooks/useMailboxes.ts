import { useState, useEffect } from 'react';
import apiClient from '../api/axios';
import { cacheService } from '../services/cacheService';
import type { Mailbox } from '../types';
import { useOnlineStatus } from './useOnlineStatus';

export const useMailboxes = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const fetchMailboxes = async () => {
      try {
        // 1. Load from cache first
        const cachedMailboxes = await cacheService.getMailboxes();
        if (cachedMailboxes.length > 0) {
          setMailboxes(cachedMailboxes);
          setLoading(false); // Show cached data immediately
        }

        // 2. Fetch from network if online
        if (isOnline) {
          const response = await apiClient.get('/mailboxes');
          const freshMailboxes = response.data.data || response.data;
          
          // Update state and cache
          setMailboxes(freshMailboxes);
          await cacheService.saveMailboxes(freshMailboxes);
        }
      } catch (err) {
        console.error('Failed to fetch mailboxes:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMailboxes();
  }, [isOnline]);

  return { mailboxes, loading, error };
};
