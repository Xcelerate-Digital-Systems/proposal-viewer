// components/admin/templates/useTemplatePackagesState.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { ProposalPackages, PackageTier } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TemplatePackagesFormState = {
  enabled: boolean;
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
};

const DEFAULT_PACKAGES: TemplatePackagesFormState = {
  enabled: true,
  title: 'Your Investment',
  intro_text: null,
  packages: [],
  footer_text: null,
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useTemplatePackagesState(templateId: string, pageCount: number) {
  const confirm = useConfirm();
  const toast = useToast();

  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesExists, setPackagesExists] = useState(false);
  const [packagesPosition, setPackagesPosition] = useState(-1);
  const [packagesIndent, setPackagesIndent] = useState(0);
  const [packagesForm, setPackagesForm] = useState<TemplatePackagesFormState>(DEFAULT_PACKAGES);
  const [packagesSaveStatus, setPackagesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const packagesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (packagesDebounce.current) clearTimeout(packagesDebounce.current);
    };
  }, []);

  // Fetch packages
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`/api/templates/packages?template_id=${templateId}`);
        if (res.ok) {
          const data = await res.json();
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
            });
          }
        }
      } catch { /* no packages yet */ }
      setPackagesLoaded(true);
    };
    fetchPackages();
  }, [templateId]);

  // Save packages
  const savePackages = useCallback(async (
    form: TemplatePackagesFormState,
    pos: number,
    indent?: number,
  ) => {
    setPackagesSaveStatus('saving');
    try {
      await fetch('/api/templates/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          enabled: form.enabled,
          position: pos,
          indent: indent ?? packagesIndent,
          title: form.title,
          intro_text: form.intro_text,
          packages: form.packages,
          footer_text: form.footer_text,
        }),
      });
      setPackagesSaveStatus('saved');
      setTimeout(() => setPackagesSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save packages');
      setPackagesSaveStatus('idle');
    }
  }, [templateId, packagesIndent, toast]);

  // Add packages page
  const addPackagesPage = useCallback(async () => {
    const pos = pageCount;
    const form = { ...DEFAULT_PACKAGES, enabled: true };
    setPackagesForm(form);
    setPackagesExists(true);
    setPackagesPosition(pos);
    await savePackages(form, pos);
    toast.success('Packages page added');
  }, [pageCount, savePackages, toast]);

  // Remove packages page
  const removePackagesPage = useCallback(async () => {
    const ok = await confirm({
      title: 'Remove Packages Page',
      message: 'Remove the packages page from this template?',
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
    savePackages, addPackagesPage, removePackagesPage,
  };
}