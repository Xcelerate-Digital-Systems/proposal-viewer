// components/admin/shared/usePackagesEditor.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PackageTier, ProposalPackages,
  PackageStyling, normalizePackageStyling, DEFAULT_PACKAGE_STYLING,
} from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ─── Internal types ──────────────────────────────────────────── */

interface UnifiedPage {
  id: string;
  entity_id: string;
  company_id: string;
  position: number;
  type: string;
  title: string;
  indent: number;
  enabled: boolean;
  link_url: string | null;
  link_label: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const DEFAULT_TIER: Omit<PackageTier, 'id' | 'sort_order'> = {
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
};

/* ─── Form state ──────────────────────────────────────────────── */

export type PackagesFormState = {
  enabled: boolean;
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
  styling: PackageStyling;
};

const DEFAULT_FORM: PackagesFormState = {
  enabled: true,
  title: 'Your Investment',
  intro_text: null,
  packages: [],
  footer_text: null,
  styling: { ...DEFAULT_PACKAGE_STYLING },
};

/* ─── Converters ──────────────────────────────────────────────── */

function unifiedToProposalPackages(page: UnifiedPage): ProposalPackages {
  return {
    id: page.id,
    proposal_id: page.entity_id,
    company_id: page.company_id,
    enabled: page.enabled,
    position: page.position,
    sort_order: page.position,
    indent: page.indent,
    title: page.title,
    intro_text: (page.payload.intro_text as string | null) ?? null,
    packages: (page.payload.packages as PackageTier[]) || [],
    footer_text: (page.payload.footer_text as string | null) ?? null,
    styling: normalizePackageStyling(page.payload.styling as PackageStyling | null),
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
}

function formFromRecord(record: ProposalPackages): PackagesFormState {
  return {
    enabled: record.enabled,
    title: record.title || 'Your Investment',
    intro_text: record.intro_text,
    packages: record.packages || [],
    footer_text: record.footer_text,
    styling: normalizePackageStyling(record.styling),
  };
}

/* ─── Hook options ────────────────────────────────────────────── */

export interface UsePackagesEditorOptions {
  apiBase: string;
  entityKey: 'proposal_id' | 'template_id';
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, string>;
}

/* ─── Hook ────────────────────────────────────────────────────── */

export function usePackagesEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields,
}: UsePackagesEditorOptions) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [allPages, setAllPages] = useState<ProposalPackages[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PackagesFormState>(DEFAULT_FORM);
  const [position, setPosition] = useState(-1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [adding, setAdding] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPage = allPages.find((p) => p.id === selectedId) ?? null;

  /* ── Fetch packages pages ───────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`${apiBase}?${entityKey}=${entityId}`);
        if (res.ok) {
          const allPagesData: UnifiedPage[] = await res.json();
          const pages = allPagesData
            .filter((p) => p.type === 'packages')
            .map(unifiedToProposalPackages);

          setAllPages(pages);
          if (pages.length > 0) {
            const first = pages[0];
            setSelectedId(first.id);
            setForm(formFromRecord(first));
            setPosition(first.position);
            setExpandedTiers(new Set((first.packages || []).map((p: PackageTier) => p.id)));
            if (!companyId && first.company_id) {
              setResolvedCompanyId(first.company_id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch packages:', err);
      }
      setLoaded(true);
    };
    fetchPackages();
  }, [apiBase, entityKey, entityId, companyId]);

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    if (!resolvedCompanyId) return;
    const fetchBranding = async () => {
      try {
        const res = await fetch(`/api/company/branding?company_id=${resolvedCompanyId}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({ ...DEFAULT_BRANDING, ...data });
        }
      } catch {
        /* Use defaults */
      }
    };
    fetchBranding();
  }, [resolvedCompanyId]);

  /* ── Select a page ──────────────────────────────────────────── */

  const selectPage = useCallback((page: ProposalPackages) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedId(page.id);
    setForm(formFromRecord(page));
    setPosition(page.position);
    setExpandedTiers(new Set((page.packages || []).map((p: PackageTier) => p.id)));
    setSaveStatus('idle');
  }, []);

  /* ── Save ───────────────────────────────────────────────────── */

  const savePkg = useCallback(
    async (id: string, data: PackagesFormState, pos: number) => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`${apiBase}?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: data.enabled,
            position: pos,
            title: data.title,
            payload_patch: {
              intro_text: data.intro_text,
              packages: data.packages,
              footer_text: data.footer_text,
              styling: data.styling,
            },
          }),
        });
        if (res.ok) {
          const updated: UnifiedPage = await res.json();
          const pkg = unifiedToProposalPackages(updated);
          setAllPages((prev) => prev.map((p) => (p.id === id ? pkg : p)));
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('idle');
          toast.error('Failed to save packages');
        }
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save packages');
      }
    },
    [apiBase, toast],
  );

  const updateForm = useCallback(
    (changes: Partial<PackagesFormState>) => {
      if (!selectedId) return;
      const id = selectedId;
      setForm((prev) => {
        const next = { ...prev, ...changes };
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => savePkg(id, next, position), 800);
        return next;
      });
    },
    [selectedId, position, savePkg],
  );

  /* ── Toggle enabled ─────────────────────────────────────────── */

  const toggleEnabled = useCallback(async () => {
    if (!selectedId) return;
    const newEnabled = !form.enabled;
    const next = { ...form, enabled: newEnabled };
    setForm(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await savePkg(selectedId, next, position);
    toast.success(newEnabled ? 'Packages page enabled' : 'Packages page disabled');
  }, [selectedId, form, position, savePkg, toast]);

  /* ── Add page ───────────────────────────────────────────────── */

  const addPage = useCallback(async () => {
    setAdding(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [entityKey]: entityId,
          ...extraPostFields,
          type: 'packages',
          enabled: true,
          title: 'Your Investment',
          payload: {
            intro_text: null,
            packages: [],
            footer_text: null,
            styling: DEFAULT_PACKAGE_STYLING,
          },
        }),
      });
      if (res.ok) {
        const created: UnifiedPage = await res.json();
        const pkg = unifiedToProposalPackages(created);
        if (!resolvedCompanyId && pkg.company_id) {
          setResolvedCompanyId(pkg.company_id);
        }
        setAllPages((prev) => [...prev, pkg]);
        selectPage(pkg);
        toast.success('Packages page added');
      } else {
        toast.error('Failed to add packages page');
      }
    } catch {
      toast.error('Failed to add packages page');
    }
    setAdding(false);
  }, [apiBase, entityKey, entityId, extraPostFields, resolvedCompanyId, selectPage, toast]);

  /* ── Delete page ────────────────────────────────────────────── */

  const deletePage = useCallback(
    async (id: string) => {
      if (!confirm('Delete this packages page? This cannot be undone.')) return;
      try {
        const res = await fetch(apiBase, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [entityKey]: entityId, page_id: id }),
        });
        if (!res.ok) {
          toast.error('Failed to delete packages page');
          return;
        }
      } catch {
        toast.error('Failed to delete packages page');
        return;
      }

      setAllPages((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (selectedId === id) {
          if (remaining.length > 0) selectPage(remaining[0]);
          else setSelectedId(null);
        }
        return remaining;
      });
      toast.success('Packages page deleted');
    },
    [apiBase, entityKey, entityId, selectedId, selectPage, toast],
  );

  /* ── Tier helpers ───────────────────────────────────────────── */

  const addTier = useCallback(() => {
    const newTier: PackageTier = {
      ...DEFAULT_TIER,
      id: generateId(),
      sort_order: form.packages.length,
    };
    updateForm({ packages: [...form.packages, newTier] });
    setExpandedTiers((prev) => new Set(Array.from(prev).concat(newTier.id)));
  }, [form.packages, updateForm]);

  const updateTier = useCallback(
    (tierId: string, changes: Partial<PackageTier>) => {
      updateForm({
        packages: form.packages.map((t) => (t.id === tierId ? { ...t, ...changes } : t)),
      });
    },
    [form.packages, updateForm],
  );

  const deleteTier = useCallback(
    (tierId: string) => {
      updateForm({ packages: form.packages.filter((t) => t.id !== tierId) });
      setExpandedTiers((prev) => {
        const s = new Set(prev);
        s.delete(tierId);
        return s;
      });
    },
    [form.packages, updateForm],
  );

  const moveTier = useCallback(
    (tierId: string, dir: 'up' | 'down') => {
      const idx = form.packages.findIndex((t) => t.id === tierId);
      if (idx < 0) return;
      const next = [...form.packages];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      updateForm({ packages: next.map((t, i) => ({ ...t, sort_order: i })) });
    },
    [form.packages, updateForm],
  );

  const toggleTierExpanded = useCallback((tierId: string) => {
    setExpandedTiers((prev) => {
      const s = new Set(prev);
      if (s.has(tierId)) s.delete(tierId);
      else s.add(tierId);
      return s;
    });
  }, []);

  /* ── Preview data ───────────────────────────────────────────── */

  const previewPackages = selectedPage
    ? {
        ...selectedPage,
        enabled: form.enabled,
        title: form.title,
        intro_text: form.intro_text,
        packages: form.packages,
        footer_text: form.footer_text,
        styling: normalizePackageStyling(form.styling),
      }
    : null;

  return {
    // Loading
    loaded,
    adding,

    // Pages
    allPages,
    selectedId,
    selectedPage,
    selectPage,
    addPage,
    deletePage,

    // Form
    form,
    updateForm,
    toggleEnabled,
    saveStatus,

    // Tiers
    expandedTiers,
    addTier,
    updateTier,
    deleteTier,
    moveTier,
    toggleTierExpanded,

    // Preview
    branding,
    previewPackages,
  };
}
