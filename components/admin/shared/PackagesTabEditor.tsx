// components/admin/shared/PackagesTabEditor.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, Loader2, Package, Plus, Trash2, Eye } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import {
  PackageTier, PackageFeature, ProposalPackages,
  PackageStyling, normalizePackageStyling, DEFAULT_PACKAGE_STYLING,
} from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import PackagesAppearanceSection from '@/components/admin/shared/PackagesAppearanceSection';
import TierEditor from '@/components/admin/shared/TierEditor';

/* ------------------------------------------------------------------ */
/*  Internal UnifiedPage shape (API v2 response)                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/** Map a UnifiedPage (v2 API response) → ProposalPackages (internal state shape) */
function unifiedToProposalPackages(page: UnifiedPage): ProposalPackages {
  return {
    id: page.id,
    proposal_id: page.entity_id,   // holds template_id when used for templates
    company_id: page.company_id,
    enabled: page.enabled,
    position: page.position,
    sort_order: page.position,
    indent: page.indent,
    title: page.title,
    intro_text: (page.payload.intro_text as string | null) ?? null,
    packages: (page.payload.packages as PackageTier[]) || [],
    footer_text: (page.payload.footer_text as string | null) ?? null,
    styling:    normalizePackageStyling(page.payload.styling as PackageStyling | null),
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Form State                                                         */
/* ------------------------------------------------------------------ */

type PackagesFormState = {
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

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PackagesTabEditorProps {
  /**
   * Unified pages API base, e.g. '/api/proposals/pages' or '/api/templates/pages'.
   * The component filters responses to type='packages' internally.
   */
  apiBase: string;
  /** The FK key for the owning entity in POST/DELETE bodies, e.g. 'proposal_id' | 'template_id' */
  entityKey: 'proposal_id' | 'template_id';
  /** The owning entity's ID */
  entityId: string;
  /**
   * Known company ID (templates pass this directly).
   * Proposals pass null — resolved from the first fetched page's company_id.
   */
  companyId: string | null;
  /** Extra fields to include in the POST body (e.g. { company_id } for templates) */
  extraPostFields?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PackagesTabEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields,
}: PackagesTabEditorProps) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [allPages, setAllPages] = useState<ProposalPackages[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PackagesFormState>(DEFAULT_FORM);
  const [position, setPosition] = useState(-1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [showPreview, setShowPreview] = useState(true);
  const [adding, setAdding] = useState(false);

  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPage = allPages.find(p => p.id === selectedId) ?? null;

  /* ── Panel height ───────────────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const top = containerRef.current.getBoundingClientRect().top;
        setPanelHeight(Math.max(400, window.innerHeight - top - 24));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* ── Fetch packages pages ───────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`${apiBase}?${entityKey}=${entityId}`);
        if (res.ok) {
          // New API returns UnifiedPage[] for ALL types — filter to packages only
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
      } catch { /* Use defaults */ }
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

  const savePkg = useCallback(async (
    id: string,
    data: PackagesFormState,
    pos: number,
  ) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`${apiBase}?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled:  data.enabled,
          position: pos,
          title:    data.title,
          // Packages-specific fields go in payload_patch (v2 API convention)
          payload_patch: {
            intro_text:  data.intro_text,
            packages:    data.packages,
            footer_text: data.footer_text,
            styling:     data.styling,
          },
        }),
      });
      if (res.ok) {
        const updated: UnifiedPage = await res.json();
        const pkg = unifiedToProposalPackages(updated);
        setAllPages(prev => prev.map(p => p.id === id ? pkg : p));
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
  }, [apiBase, toast]);

  const updateForm = useCallback((changes: Partial<PackagesFormState>) => {
    if (!selectedId) return;
    const id = selectedId;
    setForm(prev => {
      const next = { ...prev, ...changes };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => savePkg(id, next, position), 800);
      return next;
    });
  }, [selectedId, position, savePkg]);

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
          type:    'packages',
          enabled: true,
          title:   'Your Investment',
          payload: {
            intro_text:  null,
            packages:    [],
            footer_text: null,
            styling:     DEFAULT_PACKAGE_STYLING,
          },
        }),
      });
      if (res.ok) {
        const created: UnifiedPage = await res.json();
        const pkg = unifiedToProposalPackages(created);
        // Resolve company_id if not yet known
        if (!resolvedCompanyId && pkg.company_id) {
          setResolvedCompanyId(pkg.company_id);
        }
        setAllPages(prev => [...prev, pkg]);
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

  const deletePage = useCallback(async (id: string) => {
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

    setAllPages(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (selectedId === id) {
        if (remaining.length > 0) selectPage(remaining[0]);
        else setSelectedId(null);
      }
      return remaining;
    });
    toast.success('Packages page deleted');
  }, [apiBase, entityKey, entityId, selectedId, selectPage, toast]);

  /* ── Tier helpers ───────────────────────────────────────────── */

  const addTier = useCallback(() => {
    const newTier: PackageTier = {
      ...DEFAULT_TIER,
      id: generateId(),
      sort_order: form.packages.length,
    };
    updateForm({ packages: [...form.packages, newTier] });
    setExpandedTiers(prev => new Set(Array.from(prev).concat(newTier.id)));
  }, [form.packages, updateForm]);

  const updateTier = useCallback((tierId: string, changes: Partial<PackageTier>) => {
    updateForm({
      packages: form.packages.map(t => t.id === tierId ? { ...t, ...changes } : t),
    });
  }, [form.packages, updateForm]);

  const deleteTier = useCallback((tierId: string) => {
    updateForm({ packages: form.packages.filter(t => t.id !== tierId) });
    setExpandedTiers(prev => { const s = new Set(prev); s.delete(tierId); return s; });
  }, [form.packages, updateForm]);

  const moveTier = useCallback((tierId: string, dir: 'up' | 'down') => {
    const idx = form.packages.findIndex(t => t.id === tierId);
    if (idx < 0) return;
    const next = [...form.packages];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    updateForm({ packages: next.map((t, i) => ({ ...t, sort_order: i })) });
  }, [form.packages, updateForm]);

  const toggleTierExpanded = useCallback((tierId: string) => {
    setExpandedTiers(prev => {
      const s = new Set(prev);
      if (s.has(tierId)) s.delete(tierId); else s.add(tierId);
      return s;
    });
  }, []);

  /* ── Preview packages data ──────────────────────────────────── */

  const previewPackages = selectedPage
    ? {
        ...selectedPage,
        enabled:    form.enabled,
        title:      form.title,
        intro_text: form.intro_text,
        packages:   form.packages,
        footer_text: form.footer_text,
        styling:    normalizePackageStyling(form.styling),
      }
    : null;

  /* ── Render ─────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Packages Pages</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {allPages.length === 0
              ? 'No packages pages yet'
              : `${allPages.filter(p => p.enabled).length} of ${allPages.length} enabled`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-gray-300" />}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500"><Check size={12} /> Saved</span>
          )}
          {selectedId && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview ? 'bg-[#017C87]/10 text-[#017C87]' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
            >
              <Eye size={13} /> Preview
            </button>
          )}
        </div>
      </div>

      {/* Page navigation bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {allPages.map((page) => (
          <button
            key={page.id}
            onClick={() => selectPage(page)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${
              selectedId === page.id
                ? 'bg-[#017C87]/10 border-[#017C87]/30 text-[#017C87]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="truncate max-w-[140px]">{page.title || 'Untitled'}</span>
            {!page.enabled && <span className="text-[10px] opacity-50 ml-0.5">(off)</span>}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
              className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
            >
              <Trash2 size={10} />
            </span>
          </button>
        ))}
        {allPages.length === 0 && (
          <span className="text-xs text-gray-400">No pages yet — add one to get started</span>
        )}
        <button
          onClick={addPage}
          disabled={adding}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] border border-dashed border-[#017C87]/30 hover:bg-[#017C87]/5 transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Add Page
        </button>
      </div>

      {/* Body: editor + optional preview */}
      <div ref={containerRef} className="flex gap-5" style={{ height: panelHeight }}>

        {/* Editor column */}
        {selectedId && selectedPage ? (
          <div className={`flex-1 min-w-0 overflow-y-auto ${showPreview ? 'w-[55%]' : 'w-full'}`}>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Show packages page</p>
                <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in the proposal viewer</p>
              </div>
              <Toggle
                enabled={form.enabled}
                onChange={() => toggleEnabled()}
              />
            </div>

            {form.enabled ? (
              <div className="space-y-5">
                {/* Page title */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Page Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                    placeholder="Your Investment"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                  />
                </div>

                {/* Intro text */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Intro Text</label>
                  <textarea
                    value={form.intro_text ?? ''}
                    onChange={(e) => updateForm({ intro_text: e.target.value || null })}
                    placeholder="Optional introductory text above the packages…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                  />
                </div>

                {/* Tier editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">
                      Packages ({form.packages.length})
                    </label>
                    <button
                      onClick={addTier}
                      className="flex items-center gap-1 text-xs font-medium text-[#017C87] hover:text-[#017C87]/80 transition-colors"
                    >
                      <Plus size={11} /> Add Package
                    </button>
                  </div>

                  {form.packages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                      <Package size={20} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-xs text-gray-400">No packages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.packages.map((tier, idx) => (
                        <TierEditor
                          key={tier.id}
                          tier={tier}
                          tierIdx={idx}
                          totalTiers={form.packages.length}
                          isExpanded={expandedTiers.has(tier.id)}
                          onToggleExpand={() => toggleTierExpanded(tier.id)}
                          onUpdate={(changes) => updateTier(tier.id, changes)}
                          onToggleRecommended={() => updateTier(tier.id, { is_recommended: !tier.is_recommended })}
                          onMove={(dir) => moveTier(tier.id, dir)}
                          onRemove={() => deleteTier(tier.id)}
                          onAddFeature={() => updateTier(tier.id, {
                            features: [...tier.features, { bold_prefix: null, text: '', children: [] }],
                          })}
                          onUpdateFeature={(fi, changes) => {
                            const next = tier.features.map((f, i) => i === fi ? { ...f, ...changes } : f);
                            updateTier(tier.id, { features: next });
                          }}
                          onRemoveFeature={(fi) => updateTier(tier.id, { features: tier.features.filter((_, i) => i !== fi) })}
                          onAddCondition={() => updateTier(tier.id, { conditions: [...tier.conditions, ''] })}
                          onUpdateCondition={(ci, val) => {
                            const next = [...tier.conditions];
                            next[ci] = val;
                            updateTier(tier.id, { conditions: next });
                          }}
                          onRemoveCondition={(ci) => updateTier(tier.id, { conditions: tier.conditions.filter((_, i) => i !== ci) })}
                          onAddChild={(fi) => {
                            const next = tier.features.map((f, i) => i === fi
                              ? { ...f, children: [...(f.children ?? []), ''] }
                              : f
                            );
                            updateTier(tier.id, { features: next });
                          }}
                          onUpdateChild={(fi, ci, val) => {
                            const next = tier.features.map((f, i) => {
                              if (i !== fi) return f;
                              const ch = [...(f.children ?? [])];
                              ch[ci] = val;
                              return { ...f, children: ch };
                            });
                            updateTier(tier.id, { features: next });
                          }}
                          onRemoveChild={(fi, ci) => {
                            const next = tier.features.map((f, i) => i !== fi ? f : {
                              ...f, children: (f.children ?? []).filter((_, j) => j !== ci),
                            });
                            updateTier(tier.id, { features: next });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer text */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Footer Text</label>
                  <textarea
                    value={form.footer_text ?? ''}
                    onChange={(e) => updateForm({ footer_text: e.target.value || null })}
                    placeholder="Optional footer note below the packages…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                  />
                </div>

                {/* Appearance */}
                <PackagesAppearanceSection
                  styling={form.styling}
                  tiers={form.packages}
                  onStylingChange={(newStyling: PackageStyling) => updateForm({ styling: newStyling })}
                  onTierChange={(tierId: string, changes: Partial<PackageTier>) => updateTier(tierId, changes)}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                <Package size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400 mb-1">Packages page is currently disabled</p>
                <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Package size={28} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400 mb-1">No packages page selected</p>
              <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
            </div>
          </div>
        )}

        {/* Preview column */}
        {showPreview && selectedId && form.enabled && previewPackages && (
          <div className="w-[45%] shrink-0">
            <PackagesPreview packages={previewPackages} branding={branding} />
          </div>
        )}
      </div>
    </div>
  );
}