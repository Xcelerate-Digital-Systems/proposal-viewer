// components/admin/ads/AdCreativeForm.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight, BookOpen, ImagePlus, Loader2, Upload } from 'lucide-react';
import ReferenceModal from './ReferenceModal';
import type { ReferenceType } from './ReferenceModal';
import CustomSelect from './CustomSelect';
import { supabase } from '@/lib/supabase';
import type { AdCopyVariant, AdCopyVariantType } from '@/lib/types/ads';
import {
  AD_CREATIVE_STATUSES,
  AD_WINNER_STATUSES,
  AD_ITERATION_TYPES,
  AD_MEDIA_TYPES,
  AWARENESS_LEVELS,
  MARKET_SOPHISTICATION_LEVELS,
  AD_COPY_VARIANT_TYPES,
  AD_SIGNALS,
  AD_ANGLE_FAMILIES,
  AD_CREATIVE_STYLES,
  AD_CREATIVE_FORMATS,
} from '@/lib/ad-tracker/constants';

type Props = {
  trackerId: string;
  companyId: string;
  editingId: string | null;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<{ error?: string }>;
};

type FormData = {
  ad_name: string;
  image_url: string;
  signal: string;
  hypothesis: string;
  ad_concept: string;
  angle_family: string;
  angle_idea: string;
  target_market: string;
  awareness_level: string;
  market_sophistication: string;
  offer_variant: string;
  lander_variant: string;
  iteration_type: string;
  media_type: string;
  creative_style: string;
  creative_format: string;
  video_hooks: string;
  status: string;
  brief_link: string;
  creative_link: string;
  winner: string;
  launch_date: string;
  analysis_date: string;
  kill_date: string;
  creative_lifespan_days: string;
  hook_rate: string;
  hold_rate: string;
  uctr: string;
  cvr: string;
  cpl: string;
  cpl_label: string;
  next_action: string;
};

type VariantDraft = {
  id?: string;
  variant_type: AdCopyVariantType;
  label: string;
  content: string;
};

const INITIAL_FORM: FormData = {
  ad_name: '', image_url: '',
  signal: '', hypothesis: '', ad_concept: '', angle_family: '', angle_idea: '',
  target_market: '', awareness_level: '', market_sophistication: '',
  offer_variant: '', lander_variant: '',
  iteration_type: '', media_type: '', creative_style: '', creative_format: '',
  video_hooks: '', status: 'draft', brief_link: '', creative_link: '',
  winner: '', launch_date: '', analysis_date: '', kill_date: '',
  creative_lifespan_days: '', hook_rate: '', hold_rate: '', uctr: '', cvr: '',
  cpl: '', cpl_label: 'CPL', next_action: '',
};

// Map constants into CustomSelect option shapes
const signalOptions = AD_SIGNALS.map((s) => ({ value: s.value, label: s.label }));
const angleFamilyOptions = AD_ANGLE_FAMILIES.map((af) => ({ value: af.value, label: af.label, description: af.description }));
const creativeStyleOptions = AD_CREATIVE_STYLES.map((cs) => ({ value: cs.value, label: cs.label }));
const creativeFormatOptions = AD_CREATIVE_FORMATS.map((cf) => ({ value: cf.value, label: cf.label }));
const awarenessOptions = AWARENESS_LEVELS.map((al) => ({ value: al.value, label: al.label, description: al.description }));
const sophisticationOptions = MARKET_SOPHISTICATION_LEVELS.map((ms) => ({ value: ms.value, label: ms.label, description: ms.description }));
const iterationOptions = AD_ITERATION_TYPES.map((t) => ({ value: t.value, label: t.label }));
const mediaOptions = AD_MEDIA_TYPES.map((t) => ({ value: t.value, label: t.label }));

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af', briefed: '#3b82f6', in_production: '#a855f7',
  ready: '#14b8a6', live: '#22c55e', paused: '#f59e0b', killed: '#ef4444',
};
const statusOptions = AD_CREATIVE_STATUSES.map((s) => ({ value: s.value, label: s.label, color: STATUS_COLORS[s.value] }));

const WINNER_COLORS: Record<string, string> = {
  yes: '#22c55e', scaled: '#22c55e', no: '#9ca3af',
  didnt_win: '#ef4444', stopped: '#ef4444', fatigued: '#f59e0b',
};
const winnerOptions = AD_WINNER_STATUSES.map((w) => ({ value: w.value, label: w.label, color: WINNER_COLORS[w.value] }));

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface/50 hover:bg-surface text-left transition-colors"
      >
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {open ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[12px] font-medium text-muted mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-faint mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function ReferenceLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] text-teal hover:text-teal-hover font-medium transition-colors"
    >
      <BookOpen size={13} />
      {label}
    </button>
  );
}

const inputClass = 'w-full px-3 py-2 bg-surface border border-edge rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all';

export default function AdCreativeForm({ trackerId, companyId, editingId, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [sections, setSections] = useState({ strategy: true, audience: false, destination: false, execution: true, copy: false, results: false });
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editingId);
  const [error, setError] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState<ReferenceType | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing creative for editing
  const loadCreative = useCallback(async () => {
    if (!editingId) return;
    setLoadingEdit(true);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoadingEdit(false); return; }

    const res = await fetch(`/api/ads/creatives/${editingId}?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.success) { setLoadingEdit(false); return; }

    const c = json.data;
    setForm({
      ad_name: c.ad_name || '',
      image_url: c.image_url || '',
      signal: c.signal || '',
      hypothesis: c.hypothesis || '',
      ad_concept: c.ad_concept || '',
      angle_family: c.angle_family || '',
      angle_idea: c.angle_idea || '',
      target_market: c.target_market || '',
      awareness_level: c.awareness_level || '',
      market_sophistication: c.market_sophistication || '',
      offer_variant: c.offer_variant || '',
      lander_variant: c.lander_variant || '',
      iteration_type: c.iteration_type || '',
      media_type: c.media_type || '',
      creative_style: c.creative_style || '',
      creative_format: c.creative_format || '',
      video_hooks: c.video_hooks || '',
      status: c.status || 'draft',
      brief_link: c.brief_link || '',
      creative_link: c.creative_link || '',
      winner: c.winner || '',
      launch_date: c.launch_date || '',
      analysis_date: c.analysis_date || '',
      kill_date: c.kill_date || '',
      creative_lifespan_days: c.creative_lifespan_days?.toString() || '',
      hook_rate: c.hook_rate?.toString() || '',
      hold_rate: c.hold_rate?.toString() || '',
      uctr: c.uctr?.toString() || '',
      cvr: c.cvr?.toString() || '',
      cpl: c.cpl?.toString() || '',
      cpl_label: c.cpl_label || 'CPL',
      next_action: c.next_action || '',
    });

    setVariants(
      (c.ad_copy_variants || []).map((v: AdCopyVariant) => ({
        id: v.id,
        variant_type: v.variant_type,
        label: v.label,
        content: v.content,
      }))
    );

    setLoadingEdit(false);
  }, [editingId, companyId]);

  useEffect(() => {
    loadCreative();
  }, [loadCreative]);

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Image upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!editingId) return;
    setUploading(true);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setUploading(false); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('creative_id', editingId);
    formData.append('company_id', companyId);

    const res = await fetch('/api/ads/creatives/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const json = await res.json();
    setUploading(false);

    if (json.success && json.url) {
      setForm((prev) => ({ ...prev, image_url: json.url }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  // ─── Copy variants ────────────────────────────────────────────────────────
  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { variant_type: 'headline', label: `HEADLINE ${prev.filter(v => v.variant_type === 'headline').length + 1}`.padStart(2, '0'), content: '' },
    ]);
    setSections((prev) => ({ ...prev, copy: true }));
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantDraft, value: string) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad_name.trim()) return;

    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      ad_name: form.ad_name.trim(),
      image_url: form.image_url || null,
      signal: form.signal || null,
      hypothesis: form.hypothesis || null,
      ad_concept: form.ad_concept || null,
      angle_family: form.angle_family || null,
      angle_idea: form.angle_idea || null,
      target_market: form.target_market || null,
      awareness_level: form.awareness_level || null,
      market_sophistication: form.market_sophistication || null,
      offer_variant: form.offer_variant || null,
      lander_variant: form.lander_variant || null,
      iteration_type: form.iteration_type || null,
      media_type: form.media_type || null,
      creative_style: form.creative_style || null,
      creative_format: form.creative_format || null,
      video_hooks: form.video_hooks || null,
      status: form.status,
      brief_link: form.brief_link || null,
      creative_link: form.creative_link || null,
      winner: form.winner || null,
      launch_date: form.launch_date || null,
      analysis_date: form.analysis_date || null,
      kill_date: form.kill_date || null,
      creative_lifespan_days: form.creative_lifespan_days ? parseInt(form.creative_lifespan_days) : null,
      hook_rate: form.hook_rate ? parseFloat(form.hook_rate) : null,
      hold_rate: form.hold_rate ? parseFloat(form.hold_rate) : null,
      uctr: form.uctr ? parseFloat(form.uctr) : null,
      cvr: form.cvr ? parseFloat(form.cvr) : null,
      cpl: form.cpl ? parseFloat(form.cpl) : null,
      cpl_label: form.cpl_label || 'CPL',
      next_action: form.next_action || null,
      variants: variants.filter((v) => v.content.trim()),
    };

    const result = await onSave(payload);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
  };

  const toggle = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isVideo = form.image_url && /\.(mp4|mov|webm)$/i.test(form.image_url);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {editingId ? 'Edit Creative' : 'New Creative'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        {loadingEdit ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            {/* ─── Image + Name hero area ───────────────────────────────────── */}
            <div className="flex gap-6 p-6 pb-4 border-b border-edge bg-surface/30">
              {/* Image preview / upload */}
              <div className="shrink-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {uploading ? (
                  <div className="w-[200px] h-[200px] rounded-xl bg-surface border border-edge flex items-center justify-center">
                    <Loader2 size={24} className="text-teal animate-spin" />
                  </div>
                ) : form.image_url ? (
                  <div
                    className="w-[200px] h-[200px] rounded-xl overflow-hidden bg-surface border border-edge relative group cursor-pointer"
                    onClick={() => editingId && fileRef.current?.click()}
                  >
                    {isVideo ? (
                      <video src={form.image_url} className="w-full h-full object-cover" muted controls />
                    ) : (
                      <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                    {editingId && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Upload size={20} className="text-white" />
                        <span className="text-white text-[13px] font-medium">Replace</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`w-[200px] h-[200px] rounded-xl bg-surface border-2 border-dashed border-edge flex flex-col items-center justify-center gap-2 ${editingId ? 'cursor-pointer hover:border-teal/30 hover:bg-teal/5' : ''} transition-colors`}
                    onClick={() => editingId && fileRef.current?.click()}
                  >
                    <ImagePlus size={28} className="text-faint" />
                    <span className="text-[12px] text-faint">
                      {editingId ? 'Click to upload' : 'Save first to upload'}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + key info */}
              <div className="flex-1 min-w-0 space-y-3">
                <Field label="Ad Name *">
                  <input
                    type="text"
                    value={form.ad_name}
                    onChange={(e) => updateField('ad_name', e.target.value)}
                    placeholder="Use the naming convention"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Ad Concept">
                  <textarea value={form.ad_concept} onChange={(e) => updateField('ad_concept', e.target.value)} placeholder="Overall idea of the ad in 1-2 sentences" rows={2} className={inputClass + ' resize-none'} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Status">
                    <CustomSelect
                      value={form.status}
                      options={statusOptions}
                      onChange={(v) => updateField('status', v)}
                      placeholder="Select..."
                      clearable={false}
                    />
                  </Field>
                  <Field label="Type">
                    <CustomSelect
                      value={form.iteration_type}
                      options={iterationOptions}
                      onChange={(v) => updateField('iteration_type', v)}
                      placeholder="Select..."
                    />
                  </Field>
                  <Field label="Media">
                    <CustomSelect
                      value={form.media_type}
                      options={mediaOptions}
                      onChange={(v) => updateField('media_type', v)}
                      placeholder="Select..."
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* ─── Sections ─────────────────────────────────────────────────── */}
            <div className="p-6 space-y-4">
              {/* Strategy Section */}
              <Section title="Strategy" open={sections.strategy} onToggle={() => toggle('strategy')}>
                <Field label="Signal">
                  <CustomSelect
                    value={form.signal}
                    options={signalOptions}
                    onChange={(v) => updateField('signal', v)}
                    placeholder="Where does the data come from?"
                  />
                </Field>
                <Field label="Hypothesis">
                  <textarea value={form.hypothesis} onChange={(e) => updateField('hypothesis', e.target.value)} placeholder="Links one data insight to one predicted ad outcome" rows={2} className={inputClass + ' resize-none'} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Angle Family">
                    <CustomSelect
                      value={form.angle_family}
                      options={angleFamilyOptions}
                      onChange={(v) => updateField('angle_family', v)}
                      placeholder="Select angle..."
                    />
                  </Field>
                  <Field label="Angle Idea">
                    <input type="text" value={form.angle_idea} onChange={(e) => updateField('angle_idea', e.target.value)} placeholder="e.g., Real-Math, Gain/Benefit" className={inputClass} />
                  </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Signal Reference" onClick={() => setReferenceOpen('signals')} />
                  <ReferenceLink label="Angle Families" onClick={() => setReferenceOpen('angle_families')} />
                </div>
              </Section>

              {/* Audience Section */}
              <Section title="Audience" open={sections.audience} onToggle={() => toggle('audience')}>
                <Field label="Target Market">
                  <input type="text" value={form.target_market} onChange={(e) => updateField('target_market', e.target.value)} placeholder="e.g., Women Coach & Consultant Broad" className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Awareness Level">
                    <CustomSelect
                      value={form.awareness_level}
                      options={awarenessOptions}
                      onChange={(v) => updateField('awareness_level', v)}
                      placeholder="Select level..."
                    />
                  </Field>
                  <Field label="Market Sophistication">
                    <CustomSelect
                      value={form.market_sophistication}
                      options={sophisticationOptions}
                      onChange={(v) => updateField('market_sophistication', v)}
                      placeholder="Select level..."
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Awareness Levels" onClick={() => setReferenceOpen('awareness')} />
                  <ReferenceLink label="Market Sophistication" onClick={() => setReferenceOpen('sophistication')} />
                </div>
              </Section>

              {/* Destination Section */}
              <Section title="Destination" open={sections.destination} onToggle={() => toggle('destination')}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Offer Variant">
                    <input type="text" value={form.offer_variant} onChange={(e) => updateField('offer_variant', e.target.value)} placeholder="Which offer will the ad go to?" className={inputClass} />
                  </Field>
                  <Field label="Lander Variant">
                    <input type="text" value={form.lander_variant} onChange={(e) => updateField('lander_variant', e.target.value)} placeholder="Which landing page?" className={inputClass} />
                  </Field>
                </div>
              </Section>

              {/* Execution Section */}
              <Section title="Execution" open={sections.execution} onToggle={() => toggle('execution')}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Creative Style">
                    <CustomSelect
                      value={form.creative_style}
                      options={creativeStyleOptions}
                      onChange={(v) => updateField('creative_style', v)}
                      placeholder="Select style..."
                    />
                  </Field>
                  <Field label="Creative Format">
                    <CustomSelect
                      value={form.creative_format}
                      options={creativeFormatOptions}
                      onChange={(v) => updateField('creative_format', v)}
                      placeholder="Select format..."
                      searchable
                    />
                  </Field>
                </div>
                {form.media_type === 'video' && (
                  <Field label="Video Hooks">
                    <input type="text" value={form.video_hooks} onChange={(e) => updateField('video_hooks', e.target.value)} placeholder="What is the hook of the video?" className={inputClass} />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Brief Link">
                    <input type="url" value={form.brief_link} onChange={(e) => updateField('brief_link', e.target.value)} placeholder="Link to brief" className={inputClass} />
                  </Field>
                  <Field label="Creative Link">
                    <input type="url" value={form.creative_link} onChange={(e) => updateField('creative_link', e.target.value)} placeholder="Canva or Frame.io link" className={inputClass} />
                  </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Creative Styles" onClick={() => setReferenceOpen('creative_styles')} />
                  <ReferenceLink label="Creative Formats" onClick={() => setReferenceOpen('creative_formats')} />
                </div>
              </Section>

              {/* Copy Variants Section */}
              <Section title={`Ad Copy (${variants.length} variant${variants.length !== 1 ? 's' : ''})`} open={sections.copy} onToggle={() => toggle('copy')}>
                {variants.map((v, i) => (
                  <div key={i} className="border border-edge rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={v.variant_type}
                        onChange={(e) => updateVariant(i, 'variant_type', e.target.value)}
                        className="bg-surface border border-edge rounded-md px-2 py-1 text-[12px] text-ink outline-none"
                      >
                        {AD_COPY_VARIANT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={v.label}
                        onChange={(e) => updateVariant(i, 'label', e.target.value)}
                        placeholder="Label (e.g., HEADLINE 01)"
                        className="flex-1 bg-surface border border-edge rounded-md px-2 py-1 text-[12px] text-ink placeholder-faint outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-faint hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <textarea
                      value={v.content}
                      onChange={(e) => updateVariant(i, 'content', e.target.value)}
                      placeholder="Enter the copy text..."
                      rows={3}
                      className={inputClass + ' resize-none text-[12px]'}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-2 text-[13px] text-teal hover:text-teal-hover font-medium"
                >
                  <Plus size={14} />
                  Add Copy Variant
                </button>
              </Section>

              {/* Results Section */}
              <Section title="Results" open={sections.results} onToggle={() => toggle('results')}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Winner?">
                    <CustomSelect
                      value={form.winner}
                      options={winnerOptions}
                      onChange={(v) => updateField('winner', v)}
                      placeholder="Not assessed"
                    />
                  </Field>
                  <Field label="Lifespan (days)">
                    <input type="number" value={form.creative_lifespan_days} onChange={(e) => updateField('creative_lifespan_days', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Launch Date">
                    <input type="date" value={form.launch_date} onChange={(e) => updateField('launch_date', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Analysis Date">
                    <input type="date" value={form.analysis_date} onChange={(e) => updateField('analysis_date', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Kill Date">
                    <input type="date" value={form.kill_date} onChange={(e) => updateField('kill_date', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Hook Rate %" hint="% of people who watched past 3 seconds">
                    <input type="number" step="0.01" value={form.hook_rate} onChange={(e) => updateField('hook_rate', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Hold Rate %" hint="% of people who watched past the midpoint">
                    <input type="number" step="0.01" value={form.hold_rate} onChange={(e) => updateField('hold_rate', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="UCTR %" hint="Unique click-through rate (unique clicks / reach)">
                    <input type="number" step="0.0001" value={form.uctr} onChange={(e) => updateField('uctr', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="CVR" hint="Conversion rate (conversions / clicks)">
                    <input type="number" step="0.0001" value={form.cvr} onChange={(e) => updateField('cvr', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label={form.cpl_label || 'CPL'}>
                    <input type="number" step="0.01" value={form.cpl} onChange={(e) => updateField('cpl', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label="Next Action / Learning">
                  <textarea value={form.next_action} onChange={(e) => updateField('next_action', e.target.value)} placeholder="What did you learn? What's next?" rows={2} className={inputClass + ' resize-none'} />
                </Field>
              </Section>

              {error && <p className="text-[13px] text-red-600">{error}</p>}
            </div>
          </form>
        )}

        {/* Footer */}
        {!loadingEdit && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-edge shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-muted bg-surface rounded-[10px] hover:bg-edge transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.ad_name.trim() || saving}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-teal hover:bg-teal-hover rounded-[10px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Creative'}
            </button>
          </div>
        )}
      </div>

      {referenceOpen && (
        <ReferenceModal type={referenceOpen} onClose={() => setReferenceOpen(null)} />
      )}
    </div>
  );
}
