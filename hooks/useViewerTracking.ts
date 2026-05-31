'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TrackingOptions {
  shareToken: string;
  viewerEmail?: string | null;
  viewerName?: string | null;
  enabled?: boolean;
}

export function useViewerTracking({
  shareToken,
  viewerEmail,
  viewerName,
  enabled = true,
}: TrackingOptions) {
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const pagesViewedRef = useRef(new Set<number>());
  const pageTimesRef = useRef<Record<string, number>>({});
  const currentPageRef = useRef<number>(0);
  const pageStartRef = useRef(Date.now());

  const sendHeartbeat = useCallback(() => {
    if (!viewIdRef.current) return;

    const now = Date.now();
    const pageKey = String(currentPageRef.current);
    const elapsed = (now - pageStartRef.current) / 1000;
    pageTimesRef.current[pageKey] = (pageTimesRef.current[pageKey] || 0) + elapsed;
    pageStartRef.current = now;

    const totalTime = Math.round((now - startTimeRef.current) / 1000);

    fetch(`/api/proposals/share/${shareToken}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'heartbeat',
        view_id: viewIdRef.current,
        pages_viewed: pagesViewedRef.current.size,
        total_time_seconds: totalTime,
        page_times: pageTimesRef.current,
        max_scroll_depth: Math.min(
          1,
          window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
        ),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [shareToken]);

  useEffect(() => {
    if (!enabled || !shareToken) return;

    fetch(`/api/proposals/share/${shareToken}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'view_start',
        viewer_email: viewerEmail || null,
        viewer_name: viewerName || null,
        referrer: document.referrer || null,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.view_id) viewIdRef.current = data.view_id;
      })
      .catch(() => {});

    const interval = setInterval(sendHeartbeat, 30000);

    const handleBeforeUnload = () => sendHeartbeat();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      sendHeartbeat();
    };
  }, [enabled, shareToken, viewerEmail, viewerName, sendHeartbeat]);

  const trackPageView = useCallback((pageIndex: number) => {
    const now = Date.now();
    const prevKey = String(currentPageRef.current);
    const elapsed = (now - pageStartRef.current) / 1000;
    pageTimesRef.current[prevKey] = (pageTimesRef.current[prevKey] || 0) + elapsed;

    currentPageRef.current = pageIndex;
    pageStartRef.current = now;
    pagesViewedRef.current.add(pageIndex);
  }, []);

  return { trackPageView };
}
