// hooks/useNotifications.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';

export interface InAppNotification {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(userId: string | null, companyId: string | null) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const res = await authFetch('/api/notifications?limit=30');
    if (!res.ok || !mountedRef.current) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unread_count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (userId && companyId) refresh();
    return () => { mountedRef.current = false; };
  }, [userId, companyId, refresh]);

  // Real-time subscription for live badge updates.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`in_app_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mountedRef.current) return;
          const row = payload.new as InAppNotification;
          setNotifications((prev) => [row, ...prev].slice(0, 30));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    await authFetch('/api/notifications/read-all', { method: 'POST' });
  }, []);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
