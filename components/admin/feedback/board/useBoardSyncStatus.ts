'use client';

import { useCallback, useRef, useState } from 'react';

export type SyncStatus = 'idle' | 'saving' | 'error';

export function useBoardSyncStatus() {
  const inflightRef = useRef(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaving = useCallback(() => {
    inflightRef.current++;
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    setSyncStatus('saving');
  }, []);

  const markDone = useCallback((ok: boolean) => {
    inflightRef.current = Math.max(0, inflightRef.current - 1);
    if (!ok) {
      setSyncStatus('error');
      syncTimerRef.current = setTimeout(() => setSyncStatus('idle'), 4000);
    } else if (inflightRef.current === 0) {
      syncTimerRef.current = setTimeout(() => setSyncStatus('idle'), 800);
    }
  }, []);

  return { syncStatus, markSaving, markDone };
}
