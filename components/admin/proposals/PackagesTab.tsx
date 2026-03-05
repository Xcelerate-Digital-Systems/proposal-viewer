// components/admin/proposals/PackagesTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, Loader2, Package, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Star, StarOff, Palette, Eye } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import { PackageTier, PackageFeature, ProposalPackages, PackageStyling, normalizePackageStyling, DEFAULT_PACKAGE_STYLING, supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import PackagesAppearanceSection from '@/components/admin/shared/PackagesAppearanceSection';
import ColorPickerField from '@/components/ui/ColorPickerField';


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

interface PackagesTabProps {
  proposalId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PackagesTab({ proposalId }: PackagesTabProps) {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPage = allPages.find(p => p.id === selectedId) ?? null;

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  /* ── Measure panel height ───────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPanelHeight(Math.max(400, window.innerHeight - rect.top - 32));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  /* ── Fetch ──────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`/api/proposals/packages?proposal_id=${proposalId}`);
        if (res.ok) {
          const data = await res.json();
          const pages: ProposalPackages[] = Array.isArray(data) ? data : (data ? [data] : []);
          setAllPages(pages);
          if (pages.length > 0) {
            const first = pages[0];
            setSelectedId(first.id);
            setForm(formFromRecord(first));
            setPosition(first.position);
            setExpandedTiers(new Set((first.packages || []).map((p: PackageTier) => p.id)));
          }
        }
      } catch (err) {
        console.error('Failed to fetch packages:', err);
      }
      setLoaded(true);
    };
    fetchPackages();
  }, [proposalId]);

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data: proposal } = await supabase
          .from('proposals')
          .select('company_id')
          .eq('id', proposalId)
          .single();
        if (proposal?.company_id) {
          const res = await fetch(`/api/company/branding?company_id=${proposal.company_id}`);
          if (res.ok) {
            const data = await res.json();
            setBranding({ ...DEFAULT_BRANDING, ...data });
          }
        }
      } catch { /* Use defaults */ }
    };
    fetchBranding();
  }, [proposalId]);

  /* ── Sync form when selection changes ──────────────────────── */

  const selectPage = useCallback((page: ProposalPackages) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedId(page.id);
    setForm(formFromRecord(page));
    setPosition(page.position);
    setExpandedTiers(new Set((page.packages || []).map((p: PackageTier) => p.id)));
    setSaveStatus('idle');
  }, []);

  /* ── Save (PUT by id) ───────────────────────────────────────── */

  const savePkg = useCallback(async (
    id: string,
    data: PackagesFormState,
    pos: number,
  ) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/proposals/packages?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: data.enabled,
          position: pos,
          title: data.title,
          intro_text: data.intro_text,
          packages: data.packages,
          footer_text: data.footer_text,
          styling: data.styling,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAllPages(prev => prev.map(p => p.id === id ? updated : p));
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
  }, [toast]);

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

  /* ── Position change (immediate save) ──────────────────────── */

  const handlePositionChange = useCallback((newPos: number) => {
    if (!selectedId) return;
    setPosition(newPos);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    savePkg(selectedId, form, newPos);
  }, [selectedId, form, savePkg]);

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

  /* ── Add new packages page ──────────────────────────────────── */

  const addPage = useCallback(async () => {
    setAdding(true);
    try {
      const res = await fetch('/api/proposals/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: true,
          position: -1,
          title: 'Your Investment',
          intro_text: null,
          packages: [],
          footer_text: null,
          styling: DEFAULT_PACKAGE_STYLING,
        }),
      });
      if (res.ok) {
        const created: ProposalPackages = await res.json();
        setAllPages(prev => [...prev, created]);
        selectPage(created);
        toast.success('Packages page added');
      } else {
        toast.error('Failed to add packages page');
      }
    } catch {
      toast.error('Failed to add packages page');
    }
    setAdding(false);
  }, [proposalId, selectPage, toast]);

  /* ── Delete packages page ───────────────────────────────────── */

  const deletePage = useCallback(async (id: string) => {
    if (!confirm('Delete this packages page? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/proposals/packages?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = allPages.filter(p => p.id !== id);
        setAllPages(remaining);
        if (selectedId === id) {
          if (remaining.length > 0) {
            selectPage(remaining[0]);
          } else {
            setSelectedId(null);
            setForm(DEFAULT_FORM);
          }
        }
        toast.success('Packages page deleted');
      } else {
        toast.error('Failed to delete packages page');
      }
    } catch {
      toast.error('Failed to delete packages page');
    }
  }, [allPages, selectedId, selectPage, toast]);

  /* ── Tier CRUD ──────────────────────────────────────────────── */

  const addTier = () => {
    const id = generateId();
    const newTier: PackageTier = { ...DEFAULT_TIER, id, sort_order: form.packages.length };
    setExpandedTiers(prev => { const next = new Set(Array.from(prev)); next.add(id); return next; });
    updateForm({ packages: [...form.packages, newTier] });
  };

  const removeTier = (tierId: string) => {
    updateForm({ packages: form.packages.filter(t => t.id !== tierId).map((t, i) => ({ ...t, sort_order: i })) });
  };

  const updateTier = (tierId: string, changes: Partial<PackageTier>) => {
    updateForm({ packages: form.packages.map(t => t.id === tierId ? { ...t, ...changes } : t) });
  };

  const moveTier = (tierId: string, direction: 'up' | 'down') => {
    const idx = form.packages.findIndex(t => t.id === tierId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= form.packages.length) return;
    const arr = [...form.packages];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    updateForm({ packages: arr.map((t, i) => ({ ...t, sort_order: i })) });
  };

  const toggleExpand = (tierId: string) => {
    setExpandedTiers(prev => {
      const next = new Set(Array.from(prev));
      next.has(tierId) ? next.delete(tierId) : next.add(tierId);
      return next;
    });
  };

  /* ── Feature CRUD ───────────────────────────────────────────── */

  const addFeature = (tierId: string) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: [...tier.features, { text: '', bold_prefix: null, children: [] }] });
  };

  const updateFeature = (tierId: string, fi: number, changes: Partial<PackageFeature>) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: tier.features.map((f, i) => i === fi ? { ...f, ...changes } : f) });
  };

  const removeFeature = (tierId: string, fi: number) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: tier.features.filter((_, i) => i !== fi) });
  };

  /* ── Condition CRUD ─────────────────────────────────────────── */

  const addCondition = (tierId: string) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { conditions: [...tier.conditions, ''] });
  };

  const updateCondition = (tierId: string, ci: number, value: string) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { conditions: tier.conditions.map((c, i) => i === ci ? value : c) });
  };

  const removeCondition = (tierId: string, ci: number) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { conditions: tier.conditions.filter((_, i) => i !== ci) });
  };

  /* ── Sub-feature (children) CRUD ────────────────────────────── */

  const addChild = (tierId: string, fi: number) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: tier.features.map((f, i) => i === fi ? { ...f, children: [...f.children, ''] } : f) });
  };

  const updateChild = (tierId: string, fi: number, ci: number, value: string) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: tier.features.map((f, i) => {
      if (i !== fi) return f;
      return { ...f, children: f.children.map((c, j) => j === ci ? value : c) };
    }) });
  };

  const removeChild = (tierId: string, fi: number, ci: number) => {
    const tier = form.packages.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { features: tier.features.map((f, i) => {
      if (i !== fi) return f;
      return { ...f, children: f.children.filter((_, j) => j !== ci) };
    }) });
  };

  /* ── Build preview data ─────────────────────────────────────── */

  const previewPackages: ProposalPackages = {
    id: selectedId || 'preview',
    proposal_id: proposalId,
    company_id: '',
    enabled: form.enabled,
    position,
    indent: 0,
    sort_order: 0,
    title: form.title,
    intro_text: form.intro_text,
    packages: form.packages,
    footer_text: form.footer_text,
    styling: form.styling,
    created_at: '',
    updated_at: '',
  };

  /* ── Loading ────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading packages...</p>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#017C87]/10">
            <Package size={18} className="text-[#017C87]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Packages Pages</h4>
            <p className="text-xs text-gray-400">
              {allPages.length === 0 ? 'No packages pages yet' : `${allPages.filter(p => p.enabled).length} of ${allPages.length} enabled`}
            </p>
          </div>
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

      {/* Body: list + editor + preview */}
      <div ref={containerRef} className="flex gap-5" style={{ height: panelHeight }}>

        {/* ── Pages list (left column) ─────────────────────────── */}
        <div className="w-48 shrink-0 flex flex-col gap-2">
          <div className="flex-1 overflow-y-auto space-y-1">
            {allPages.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                <Package size={18} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No pages yet</p>
              </div>
            )}
            {allPages.map((page) => (
              <div
                key={page.id}
                onClick={() => selectPage(page)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedId === page.id
                    ? 'bg-[#017C87]/8 border border-[#017C87]/20'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${selectedId === page.id ? 'text-[#017C87]' : 'text-gray-700'}`}>
                    {page.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {page.enabled ? 'Enabled' : 'Disabled'} · {page.packages?.length ?? 0} tier{page.packages?.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 hover:text-red-500 text-gray-300 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addPage}
            disabled={adding}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#017C87] bg-[#017C87]/5 hover:bg-[#017C87]/10 transition-colors disabled:opacity-50 shrink-0"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add Page
          </button>
        </div>

        {/* ── Editor (center column) ───────────────────────────── */}
        {selectedId && selectedPage ? (
          <div className={`flex-1 min-w-0 overflow-y-auto ${showPreview ? 'max-w-[55%]' : ''}`}>
            <div className="space-y-6">
              {/* Page-level controls */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Status</p>
                    <Toggle enabled={form.enabled} onChange={toggleEnabled} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
                    <select
                      value={position}
                      onChange={e => handlePositionChange(Number(e.target.value))}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                    >
                      <option value={0}>Before page 1</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>After page {n}</option>
                      ))}
                      <option value={-1}>End of document</option>
                    </select>
                  </div>
                </div>
              </div>

              {form.enabled ? (
                <>
                  {/* Page settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Page Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => updateForm({ title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                        placeholder="Your Investment"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Intro Text (optional)</label>
                      <textarea
                        value={form.intro_text || ''}
                        onChange={e => updateForm({ intro_text: e.target.value || null })}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                        placeholder="Choose the package that best suits your needs..."
                      />
                    </div>
                  </div>

                  {/* Package tiers */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Package Tiers</label>
                      <button
                        onClick={addTier}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#017C87] bg-[#017C87]/5 hover:bg-[#017C87]/10 transition-colors"
                      >
                        <Plus size={12} /> Add Package
                      </button>
                    </div>

                    {form.packages.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                        <Package size={20} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-400 mb-1">No packages yet</p>
                        <p className="text-xs text-gray-300">Add a package to get started</p>
                      </div>
                    )}

                    {form.packages.map((tier, tierIdx) => {
                      const isExpanded = expandedTiers.has(tier.id);
                      return (
                        <TierEditor
                          key={tier.id}
                          tier={tier}
                          tierIdx={tierIdx}
                          totalTiers={form.packages.length}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleExpand(tier.id)}
                          onUpdate={(changes) => updateTier(tier.id, changes)}
                          onToggleRecommended={() => {
                            const newRecommended = !tier.is_recommended;
                            updateForm({
                              packages: form.packages.map(t => ({
                                ...t,
                                is_recommended: t.id === tier.id ? newRecommended : false,
                              })),
                            });
                          }}
                          onMove={(dir) => moveTier(tier.id, dir)}
                          onRemove={() => removeTier(tier.id)}
                          onAddFeature={() => addFeature(tier.id)}
                          onUpdateFeature={(fi, changes) => updateFeature(tier.id, fi, changes)}
                          onRemoveFeature={(fi) => removeFeature(tier.id, fi)}
                          onAddCondition={() => addCondition(tier.id)}
                          onUpdateCondition={(ci, val) => updateCondition(tier.id, ci, val)}
                          onRemoveCondition={(ci) => removeCondition(tier.id, ci)}
                          onAddChild={(fi) => addChild(tier.id, fi)}
                          onUpdateChild={(fi, ci, val) => updateChild(tier.id, fi, ci, val)}
                          onRemoveChild={(fi, ci) => removeChild(tier.id, fi, ci)}
                          recommendedTextColor={form.styling.recommended_text_color}
                          onRecommendedTextColorChange={(color) => {
                            updateForm({ styling: { ...form.styling, recommended_text_color: color } });
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Footer text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Footer Text (optional)</label>
                    <textarea
                      value={form.footer_text || ''}
                      onChange={e => updateForm({ footer_text: e.target.value || null })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                      placeholder="* Terms and conditions apply..."
                    />
                  </div>

                  {/* Appearance */}
                  <PackagesAppearanceSection
                    styling={form.styling}
                    tiers={form.packages}
                    onStylingChange={(styling) => updateForm({ styling })}
                    onTierChange={(tierId, changes) => {
                      updateForm({
                        packages: form.packages.map(t => t.id === tierId ? { ...t, ...changes } : t),
                      });
                    }}
                  />
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                  <Package size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400 mb-1">Packages page is currently disabled</p>
                  <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
                </div>
              )}
            </div>
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

        {/* ── Preview (right column) ───────────────────────────── */}
        {showPreview && selectedId && form.enabled && (
          <div className="w-[45%] shrink-0">
            <PackagesPreview packages={previewPackages} branding={branding} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TierEditor sub-component                                           */
/* ------------------------------------------------------------------ */

interface TierEditorProps {
  tier: PackageTier;
  tierIdx: number;
  totalTiers: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (changes: Partial<PackageTier>) => void;
  onToggleRecommended: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
  onAddFeature: () => void;
  onUpdateFeature: (fi: number, changes: Partial<PackageFeature>) => void;
  onRemoveFeature: (fi: number) => void;
  onAddCondition: () => void;
  onUpdateCondition: (ci: number, val: string) => void;
  onRemoveCondition: (ci: number) => void;
  onAddChild: (fi: number) => void;
  onUpdateChild: (fi: number, ci: number, val: string) => void;
  onRemoveChild: (fi: number, ci: number) => void;
  recommendedTextColor: string | null;
  onRecommendedTextColorChange: (color: string | null) => void;
}

function TierEditor({
  tier, tierIdx, totalTiers, isExpanded, onToggleExpand,
  onUpdate, onToggleRecommended, onMove, onRemove,
  onAddFeature, onUpdateFeature, onRemoveFeature,
  onAddCondition, onUpdateCondition, onRemoveCondition,
  onAddChild, onUpdateChild, onRemoveChild,
  recommendedTextColor, onRecommendedTextColorChange,
}: TierEditorProps) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Tier header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <button onClick={onToggleExpand} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className="text-xs font-medium text-gray-700 truncate">{tier.name || 'Unnamed'}</span>
          {tier.is_recommended && <Star size={10} className="text-amber-400 shrink-0" fill="currentColor" />}
          {isExpanded ? <ChevronUp size={12} className="text-gray-400 shrink-0 ml-auto" /> : <ChevronDown size={12} className="text-gray-400 shrink-0 ml-auto" />}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onMove('up')} disabled={tierIdx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronUp size={12} /></button>
          <button onClick={() => onMove('down')} disabled={tierIdx === totalTiers - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronDown size={12} /></button>
          <button onClick={onToggleRecommended} className={`p-1 rounded transition-colors ${tier.is_recommended ? 'text-amber-400 hover:bg-amber-50' : 'text-gray-300 hover:bg-gray-200'}`} title={tier.is_recommended ? 'Remove recommended' : 'Mark as recommended'}>
            {tier.is_recommended ? <Star size={12} fill="currentColor" /> : <StarOff size={12} />}
          </button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Tier body */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Name + price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Package Name</label>
              <input type="text" value={tier.name} onChange={e => onUpdate({ name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="Starter" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price</label>
              <input type="number" value={tier.price} onChange={e => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="0" />
            </div>
          </div>

          {/* Prefix + suffix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price Prefix</label>
              <input type="text" value={tier.price_prefix} onChange={e => onUpdate({ price_prefix: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="FROM" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Price Suffix</label>
              <input type="text" value={tier.price_suffix} onChange={e => onUpdate({ price_suffix: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                placeholder="/month" />
            </div>
          </div>

          {/* Highlight color */}
          <div className="flex items-center gap-3">
            <ColorPickerField
              label="Highlight Color"
              value={tier.highlight_color || ''}
              fallback="#017C87"
              onChange={(val) => onUpdate({ highlight_color: val || null })}
              onReset={() => onUpdate({ highlight_color: null })}
            />
            {tier.is_recommended && (
              <ColorPickerField
                label="Badge Text Color"
                value={recommendedTextColor || ''}
                fallback="#ffffff"
                onChange={(val) => onRecommendedTextColorChange(val || null)}
                onReset={() => onRecommendedTextColorChange(null)}
              />
            )}
          </div>

          {/* Features */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Features</label>
              <button onClick={onAddFeature} className="flex items-center gap-1 text-[10px] text-[#017C87] hover:text-[#017C87]/80 transition-colors">
                <Plus size={10} /> Add
              </button>
            </div>
            {tier.features.map((feature, fi) => (
              <div key={fi} className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={feature.bold_prefix || ''}
                    onChange={e => onUpdateFeature(fi, { bold_prefix: e.target.value || null })}
                    className="w-28 px-2 py-1 rounded border border-gray-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                    placeholder="Bold prefix"
                  />
                  <input
                    type="text"
                    value={feature.text}
                    onChange={e => onUpdateFeature(fi, { text: e.target.value })}
                    className="flex-1 px-2 py-1 rounded border border-gray-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                    placeholder="Feature description"
                  />
                  <button onClick={() => onAddChild(fi)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors" title="Add sub-feature">
                    <Plus size={10} />
                  </button>
                  <button onClick={() => onRemoveFeature(fi)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={10} />
                  </button>
                </div>
                {feature.children.map((child, ci) => (
                  <div key={ci} className="flex gap-2 pl-4">
                    <input
                      type="text"
                      value={child}
                      onChange={e => onUpdateChild(fi, ci, e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-gray-100 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#017C87]/20 bg-gray-50"
                      placeholder="Sub-feature"
                    />
                    <button onClick={() => onRemoveChild(fi, ci)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Conditions / Notes</label>
              <button onClick={onAddCondition} className="flex items-center gap-1 text-[10px] text-[#017C87] hover:text-[#017C87]/80 transition-colors">
                <Plus size={10} /> Add
              </button>
            </div>
            {tier.conditions.map((condition, ci) => (
              <div key={ci} className="flex gap-2">
                <input
                  type="text"
                  value={condition}
                  onChange={e => onUpdateCondition(ci, e.target.value)}
                  className="flex-1 px-2 py-1 rounded border border-gray-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#017C87]/20"
                  placeholder="* Minimum 3 month contract"
                />
                <button onClick={() => onRemoveCondition(ci)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}