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
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Derive unread count from the notifications array so the two can never drift.
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ limit: '30' });
    if (companyId) params.set('company_id', companyId);
    const res = await authFetch(`/api/notifications?${params}`);
    if (!res.ok || !mountedRef.current) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    mountedRef.current = true;
    if (userId && companyId) refresh();
    return () => { mountedRef.current = false; };
  }, [userId, companyId, refresh]);

  // Real-time subscription for live badge updates.
  useEffect(() => {
    if (!userId || !companyId) return;

    const channel = supabase
      .channel(`in_app_notifications:${userId}:${companyId}`)
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
          const row = payload.new as InAppNotification & { company_id?: string };
          if (row.company_id && row.company_id !== companyId) return;
          setNotifications((prev) => [row, ...prev].slice(0, 30));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, companyId]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    const prev = notifications;
    setNotifications((p) => p.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const params = companyId ? `?company_id=${companyId}` : '';
    const res = await authFetch(`/api/notifications/read-all${params}`, { method: 'POST' });
    if (!res.ok) setNotifications(prev);
  }, [companyId, notifications]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
