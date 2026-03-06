// components/admin/page-editor/usePackagesState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { ProposalPackages } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function usePackagesState(proposalId: string) {
  const confirm = useConfirm();
  const toast = useToast();

  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesPages, setPackagesPages] = useState<ProposalPackages[]>([]);
  const [packagesSaveStatuses, setPackagesSaveStatuses] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  // Per-record debounce timers
  const debounces = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(debounces.current).forEach(clearTimeout);
    };
  }, []);

  /* ── Fetch ──────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`/api/proposals/packages?proposal_id=${proposalId}`);
        if (res.ok) {
          const data = await res.json();
          setPackagesPages(Array.isArray(data) ? data : data ? [data] : []);
        }
      } catch { /* no packages yet */ }
      setPackagesLoaded(true);
    };
    fetchPackages();
  }, [proposalId]);

  /* ── Save a single record ───────────────────────────────────── */

  // AFTER
  const savePackagesRecord = useCallback(async (record: ProposalPackages) => {
    setPackagesSaveStatuses((prev) => ({ ...prev, [record.id]: 'saving' }));
    try {
      await fetch(`/api/proposals/packages?id=${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: record.enabled,
          position: record.position,
          sort_order: record.sort_order,
          indent: record.indent,
          title: record.title,
          intro_text: record.intro_text,
          packages: record.packages,
          footer_text: record.footer_text,
          styling: record.styling,
        }),
      });
      setPackagesSaveStatuses((prev) => ({ ...prev, [record.id]: 'saved' }));
      setTimeout(() => setPackagesSaveStatuses((prev) => ({ ...prev, [record.id]: 'idle' })), 2000);
    } catch {
      toast.error('Failed to save packages');
      setPackagesSaveStatuses((prev) => ({ ...prev, [record.id]: 'idle' }));
    }
  }, [proposalId, toast]);

  /* ── Debounced update ───────────────────────────────────────── */

  const updatePackagesPage = useCallback((id: string, changes: Partial<ProposalPackages>) => {
    setPackagesPages((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...changes };
        if (debounces.current[id]) clearTimeout(debounces.current[id]);
        debounces.current[id] = setTimeout(() => savePackagesRecord(next), 800);
        return next;
      });
      return updated;
    });
  }, [savePackagesRecord]);

  /* ── Immediate position update ──────────────────────────────── */

  const updatePackagesPagePosition = useCallback((id: string, newPos: number) => {
    setPackagesPages((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, position: newPos } : p);
      const record = updated.find((p) => p.id === id);
      if (record) savePackagesRecord(record);
      return updated;
    });
  }, [savePackagesRecord]);

  /* ── Flush all pending saves ────────────────────────────────── */

  const flushPackagesSaves = useCallback(async () => {
    const pending = Object.entries(debounces.current);
    for (const [id, timer] of pending) {
      clearTimeout(timer);
      delete debounces.current[id];
      const record = packagesPages.find((p) => p.id === id);
      if (record) await savePackagesRecord(record);
    }
  }, [packagesPages, savePackagesRecord]);

  /* ── Add a new packages page ────────────────────────────────── */

  const addPackagesPage = useCallback(async (): Promise<ProposalPackages | null> => {
    try {
      const res = await fetch('/api/proposals/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: true,
          title: 'Your Investment',
          intro_text: null,
          packages: [],
          footer_text: null,
          position: -1,
          indent: 0,
        }),
      });
      if (!res.ok) {
        toast.error('Failed to add packages page');
        return null;
      }
      const newRecord: ProposalPackages = await res.json();
      setPackagesPages((prev) => [...prev, newRecord]);
      toast.success('Packages page added');
      return newRecord;
    } catch {
      toast.error('Failed to add packages page');
      return null;
    }
  }, [proposalId, toast]);

  /* ── Remove (disable) a specific packages page ──────────────── */

  const removePackagesPage = useCallback(async (id: string): Promise<boolean> => {
    const ok = await confirm({
      title: 'Remove packages page?',
      message: 'This will disable the packages page. Your package data will be preserved and can be re-enabled later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return false;

    setPackagesPages((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, enabled: false } : p);
      const record = updated.find((p) => p.id === id);
      if (record) savePackagesRecord(record);
      return updated;
    });
    toast.success('Packages page removed');
    return true;
  }, [confirm, savePackagesRecord, toast]);

  return {
    packagesLoaded,
    packagesPages,
    packagesSaveStatuses,
    updatePackagesPage,
    updatePackagesPagePosition,
    flushPackagesSaves,
    addPackagesPage,
    removePackagesPage,
  };
}