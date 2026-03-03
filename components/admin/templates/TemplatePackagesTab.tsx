// components/admin/templates/TemplatePackagesTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Check, Loader2, ToggleLeft, ToggleRight, Package, Plus, Trash2,
  GripVertical, ChevronDown, ChevronUp, Star, StarOff, Palette, Eye,
} from 'lucide-react';
import { PackageTier, PackageFeature, ProposalPackages } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import PackagesPage from '@/components/viewer/PackagesPage';

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

const DEFAULT_BRANDING: CompanyBranding = {
  name: '',
  logo_url: null,
  accent_color: '#ff6700',
  website: null,
  bg_primary: '#0f0f0f',
  bg_secondary: '#141414',
  sidebar_text_color: '#ffffff',
  accept_text_color: '#ffffff',
  cover_bg_style: 'gradient',
  cover_bg_color_1: '#0f0f0f',
  cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff',
  cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700',
  cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65,
  cover_gradient_type: 'linear',
  cover_gradient_angle: 135,
  font_heading: null,
  font_body: null,
  font_sidebar: null,
  font_heading_weight: null,
  font_body_weight: null,
  font_sidebar_weight: null,
  text_page_bg_color: '#141414',
  text_page_text_color: '#ffffff',
  text_page_heading_color: null,
  text_page_font_size: '14',
  text_page_border_enabled: true,
  text_page_border_color: null,
  text_page_border_radius: '12',
  text_page_layout: 'contained',
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
};

const DEFAULT_FORM: PackagesFormState = {
  enabled: true,
  title: 'Your Investment',
  intro_text: null,
  packages: [],
  footer_text: null,
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TemplatePackagesTabProps {
  templateId: string;
  companyId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplatePackagesTab({ templateId, companyId }: TemplatePackagesTabProps) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [position, setPosition] = useState(-1);
  const [form, setForm] = useState<PackagesFormState>(DEFAULT_FORM);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [showPreview, setShowPreview] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.4);
  const previewRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  /* ── Fetch ──────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch(`/api/templates/packages?template_id=${templateId}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setExists(true);
            setPosition(data.position);
            setForm({
              enabled: data.enabled,
              title: data.title || 'Your Investment',
              intro_text: data.intro_text,
              packages: data.packages || [],
              footer_text: data.footer_text,
            });
            setExpandedTiers(new Set((data.packages || []).map((p: PackageTier) => p.id)));
          }
        }
      } catch (err) {
        console.error('Failed to fetch template packages:', err);
      }
      setLoaded(true);
    };
    fetchPackages();
  }, [templateId]);

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch(`/api/company/branding?company_id=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({ ...DEFAULT_BRANDING, ...data });
        }
      } catch { /* Use defaults */ }
    };
    fetchBranding();
  }, [companyId]);

  /* ── Preview scale ──────────────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (previewRef.current) {
        const width = previewRef.current.offsetWidth - 2;
        setPreviewScale(Math.min(0.55, width / 1020));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [showPreview]);

  /* ── Save ───────────────────────────────────────────────────── */

  const savePkg = useCallback(async (
    data: PackagesFormState, currentExists: boolean, currentPosition: number,
  ) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/templates/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId, company_id: companyId,
          enabled: data.enabled, position: currentPosition,
          title: data.title, intro_text: data.intro_text,
          packages: data.packages, footer_text: data.footer_text,
        }),
      });
      if (res.ok) {
        if (!currentExists) setExists(true);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else { setSaveStatus('idle'); toast.error('Failed to save packages'); }
    } catch { setSaveStatus('idle'); toast.error('Failed to save packages'); }
  }, [templateId, companyId, toast]);

  const updateForm = useCallback((changes: Partial<PackagesFormState>) => {
    setForm(prev => {
      const next = { ...prev, ...changes };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => savePkg(next, exists, position), 800);
      return next;
    });
  }, [exists, position, savePkg]);

  /* ── Toggle ─────────────────────────────────────────────────── */

  const toggleEnabled = useCallback(async () => {
    const newEnabled = !form.enabled;
    const next = { ...form, enabled: newEnabled };
    setForm(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await savePkg(next, exists, position);
    toast.success(newEnabled ? 'Packages page enabled' : 'Packages page disabled');
  }, [form, exists, position, savePkg, toast]);

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
      const next = new Set(prev);
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
    id: 'preview', proposal_id: templateId, company_id: companyId, enabled: form.enabled,
    position, indent: 0, title: form.title, intro_text: form.intro_text,
    packages: form.packages, footer_text: form.footer_text, created_at: '', updated_at: '',
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
    <div className="flex gap-6 p-6 h-full">
      {/* ── Left: Form ─────────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 overflow-y-auto ${showPreview ? 'max-w-[55%]' : ''}`}>
        {/* Toggle header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#017C87]/10">
              <Package size={18} className="text-[#017C87]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Packages Page</h4>
              <p className="text-xs text-gray-400">
                {form.enabled ? 'Included in template' : 'Not included in template'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-gray-300" />}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-emerald-500"><Check size={12} /> Saved</span>
            )}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview ? 'bg-[#017C87]/10 text-[#017C87]' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              <Eye size={13} /> Preview
            </button>
            <button onClick={toggleEnabled} className="flex items-center gap-2 text-sm font-medium transition-colors">
              {form.enabled ? (
                <><ToggleRight size={28} className="text-[#017C87]" /><span className="text-[#017C87]">Enabled</span></>
              ) : (
                <><ToggleLeft size={28} className="text-gray-300" /><span className="text-gray-400">Disabled</span></>
              )}
            </button>
          </div>
        </div>

        {form.enabled ? (
          <div className="space-y-6">
            {/* Page settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page Title</label>
                <input type="text" value={form.title} onChange={e => updateForm({ title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                  placeholder="Your Investment – Monthly" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Intro Text (optional)</label>
                <textarea value={form.intro_text || ''} onChange={e => updateForm({ intro_text: e.target.value || null })}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                  placeholder="Choose the package that best suits your needs..." />
              </div>
            </div>

            {/* Package tiers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Package Tiers</label>
                <button onClick={addTier}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#017C87] bg-[#017C87]/5 hover:bg-[#017C87]/10 transition-colors">
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
                  />
                );
              })}
            </div>

            {/* Footer text */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Footer Text (optional)</label>
              <textarea value={form.footer_text || ''} onChange={e => updateForm({ footer_text: e.target.value || null })}
                rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] resize-none"
                placeholder="* Terms and conditions apply..." />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
            <Package size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Packages page is currently disabled</p>
            <p className="text-xs text-gray-300">Toggle the switch above to add a packages page to this template</p>
          </div>
        )}
      </div>

      {/* ── Right: Live Preview ────────────────────────────────── */}
      {showPreview && form.enabled && (
        <div ref={previewRef} className="w-[45%] shrink-0 flex flex-col min-h-0 sticky top-0 self-start" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
            <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Live Preview</span>
              <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
                <Package size={11} /> {form.title}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto"
                style={{ transformOrigin: 'top left', transform: `scale(${previewScale})`, width: `${100 / previewScale}%`, height: `${100 / previewScale}%` }}>
                {form.packages.length > 0 ? (
                  <PackagesPage packages={previewPackages} branding={branding} />
                ) : (
                  <div className="w-full min-h-full flex items-center justify-center" style={{ backgroundColor: branding.bg_primary || '#0f0f0f' }}>
                    <div className="text-center">
                      <Package size={32} className="mx-auto mb-3" style={{ color: `${branding.sidebar_text_color || '#ffffff'}55` }} />
                      <p className="text-sm" style={{ color: `${branding.sidebar_text_color || '#ffffff'}88` }}>Add packages to see a preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
              <span className="text-[10px] text-gray-400">
                {form.packages.length} package{form.packages.length !== 1 ? 's' : ''} · Scales to fit
              </span>
            </div>
          </div>
        </div>
      )}
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
}

function TierEditor({
  tier, tierIdx, totalTiers, isExpanded, onToggleExpand,
  onUpdate, onMove, onRemove,
  onAddFeature, onUpdateFeature, onRemoveFeature,
  onAddCondition, onUpdateCondition, onRemoveCondition,
  onAddChild, onUpdateChild, onRemoveChild,
}: TierEditorProps) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Tier header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={onToggleExpand}>
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-700 truncate">{tier.name || 'Untitled Package'}</span>
          {tier.price > 0 && <span className="ml-2 text-xs text-gray-400">${tier.price.toLocaleString()}{tier.price_suffix}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tier.is_recommended && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Recommended</span>}
          <button onClick={e => { e.stopPropagation(); onMove('up'); }} disabled={tierIdx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
          <button onClick={e => { e.stopPropagation(); onMove('down'); }} disabled={tierIdx === totalTiers - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Tier body */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Package Name</label>
              <input type="text" value={tier.name} onChange={e => onUpdate({ name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
              <input type="number" value={tier.price} onChange={e => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price Prefix</label>
              <input type="text" value={tier.price_prefix} onChange={e => onUpdate({ price_prefix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="FROM" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price Suffix</label>
              <input type="text" value={tier.price_suffix} onChange={e => onUpdate({ price_suffix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="/month" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onUpdate({ is_recommended: !tier.is_recommended })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tier.is_recommended ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
              }`}>
              {tier.is_recommended ? <Star size={12} /> : <StarOff size={12} />}
              {tier.is_recommended ? 'Recommended' : 'Not Recommended'}
            </button>
            <div className="flex items-center gap-2">
              <Palette size={12} className="text-gray-400" />
              <label className="text-xs text-gray-500">Highlight:</label>
              <input type="color" value={tier.highlight_color || '#017C87'} onChange={e => onUpdate({ highlight_color: e.target.value })}
                className="w-7 h-7 rounded border border-gray-200 cursor-pointer" />
              {tier.highlight_color && <button onClick={() => onUpdate({ highlight_color: null })} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Conditions / Notes</label>
              <button onClick={onAddCondition} className="text-xs text-[#017C87] hover:text-[#017C87]/80">+ Add</button>
            </div>
            {tier.conditions.map((cond, ci) => (
              <div key={ci} className="flex items-center gap-2 mb-1.5">
                <input type="text" value={cond} onChange={e => onUpdateCondition(ci, e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="e.g. Excludes Ad Spend*" />
                <button onClick={() => onRemoveCondition(ci)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Features</label>
              <button onClick={onAddFeature} className="text-xs text-[#017C87] hover:text-[#017C87]/80">+ Add Feature</button>
            </div>
            {tier.features.map((feat, fi) => (
              <div key={fi} className="mb-3 pl-2 border-l-2 border-gray-100">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input type="text" value={feat.text} onChange={e => onUpdateFeature(fi, { text: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="Feature description" />
                    <input type="text" value={feat.bold_prefix || ''} onChange={e => onUpdateFeature(fi, { bold_prefix: e.target.value || null })}
                      className="w-full px-2.5 py-1.5 rounded border border-gray-100 text-xs text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="Bold prefix (optional)" />
                    {feat.children.map((child, ci) => (
                      <div key={ci} className="flex items-center gap-1.5 ml-3">
                        <span className="text-gray-300 text-xs">↳</span>
                        <input type="text" value={child} onChange={e => onUpdateChild(fi, ci, e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]" placeholder="Sub-feature" />
                        <button onClick={() => onRemoveChild(fi, ci)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                      </div>
                    ))}
                    <button onClick={() => onAddChild(fi)} className="ml-3 text-xs text-gray-400 hover:text-[#017C87]">+ Sub-feature</button>
                  </div>
                  <button onClick={() => onRemoveFeature(fi)} className="p-1 text-red-400 hover:text-red-600 mt-1"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}