// components/admin/page-editor/usePackagesState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { ProposalPackages, PackageTier, PackageStyling, normalizePackageStyling, DEFAULT_PACKAGE_STYLING } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PackagesFormState = {
  enabled: boolean;
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
  styling: PackageStyling;
};

export const DEFAULT_PACKAGES: PackagesFormState = {
  enabled: true,
  title: 'Your Investment',
  intro_text: null,
  packages: [],
  footer_text: null,
  styling: { ...DEFAULT_PACKAGE_STYLING },
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function usePackagesState(proposalId: string) {
  const confirm = useConfirm();
  const toast = useToast();

  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesExists, setPackagesExists] = useState(false);
  const [packagesPosition, setPackagesPosition] = useState(-1);
  const [packagesIndent, setPackagesIndent] = useState(0);
  const [packagesForm, setPackagesForm] = useState<PackagesFormState>(DEFAULT_PACKAGES);
  const [packagesSaveStatus, setPackagesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const packagesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (packagesDebounce.current) clearTimeout(packagesDebounce.current);
    };
  }, []);

  /* ── Fetch ──────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`/api/proposals/packages?proposal_id=${proposalId}`);
        if (res.ok) {
          const data: ProposalPackages | null = await res.json();
          if (data) {
            setPackagesExists(true);
            setPackagesPosition(data.position);
            setPackagesIndent(data.indent ?? 0);
            setPackagesForm({
              enabled: data.enabled,
              title: data.title || 'Your Investment',
              intro_text: data.intro_text,
              packages: data.packages || [],
              footer_text: data.footer_text,
              styling: normalizePackageStyling(data.styling),
            });
          }
        }
      } catch { /* no packages yet */ }
      setPackagesLoaded(true);
    };
    fetchPackages();
  }, [proposalId]);

  /* ── Save ───────────────────────────────────────────────────── */

  const savePackages = useCallback(async (
    form: PackagesFormState,
    pos: number,
    indent?: number,
  ) => {
    setPackagesSaveStatus('saving');
    try {
      await fetch('/api/proposals/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: form.enabled,
          position: pos,
          indent: indent ?? packagesIndent,
          title: form.title,
          intro_text: form.intro_text,
          packages: form.packages,
          footer_text: form.footer_text,
          styling: form.styling,
        }),
      });
      setPackagesSaveStatus('saved');
      setTimeout(() => setPackagesSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save packages');
      setPackagesSaveStatus('idle');
    }
  }, [proposalId, packagesIndent, toast]);

  /* ── Debounced save scheduler ───────────────────────────────── */

  const schedulePackagesSave = useCallback((form: PackagesFormState, pos: number) => {
    if (packagesDebounce.current) clearTimeout(packagesDebounce.current);
    packagesDebounce.current = setTimeout(() => {
      savePackages(form, pos);
      packagesDebounce.current = null;
    }, 800);
  }, [savePackages]);

  /* ── Update form ────────────────────────────────────────────── */

  const updatePackages = useCallback((changes: Partial<PackagesFormState>) => {
    setPackagesForm((prev) => {
      const next = { ...prev, ...changes };
      schedulePackagesSave(next, packagesPosition);
      return next;
    });
  }, [schedulePackagesSave, packagesPosition]);

  /* ── Flush pending save ─────────────────────────────────────── */

  const flushPackagesSave = useCallback(async () => {
    if (packagesDebounce.current) {
      clearTimeout(packagesDebounce.current);
      packagesDebounce.current = null;
      await savePackages(packagesForm, packagesPosition);
    }
  }, [savePackages, packagesForm, packagesPosition]);

  /* ── Add packages page ──────────────────────────────────────── */

  const addPackagesPage = useCallback(async () => {
    setPackagesExists(true);
    setPackagesForm(DEFAULT_PACKAGES);
    setPackagesPosition(-1);
    await savePackages(DEFAULT_PACKAGES, -1);
    toast.success('Packages page added');
  }, [savePackages, toast]);

  /* ── Remove (disable) packages page ─────────────────────────── */

  const removePackagesPage = useCallback(async () => {
    const ok = await confirm({
      title: 'Remove packages page?',
      message: 'This will disable the packages page. Your package data will be preserved and can be re-enabled later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return false;

    const updated = { ...packagesForm, enabled: false };
    setPackagesForm(updated);
    await savePackages(updated, packagesPosition);
    toast.success('Packages page removed');
    return true;
  }, [confirm, packagesForm, packagesPosition, savePackages, toast]);

  return {
    packagesLoaded, packagesExists, packagesPosition, setPackagesPosition,
    packagesIndent, setPackagesIndent,
    packagesForm, setPackagesForm, packagesSaveStatus,
    savePackages, schedulePackagesSave, updatePackages, flushPackagesSave,
    addPackagesPage, removePackagesPage,
  };
}