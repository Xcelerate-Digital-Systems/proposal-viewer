// components/admin/ads/AdCreativeForm.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, BookOpen, ImagePlus, Loader2, Upload } from 'lucide-react';
import ReferenceTabContent from './ReferenceTabContent';
import type { TabType } from './ReferenceTabContent';
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
  AD_SIGNALS,
  AD_ANGLE_FAMILIES,
  AD_CREATIVE_STYLES,
  AD_CREATIVE_FORMATS,
  AD_ANGLE_IDEAS,
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
  ad_copy_link: string;
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
  video_hooks: '', status: 'draft', brief_link: '', creative_link: '', ad_copy_link: '',
  winner: '', launch_date: '', analysis_date: '', kill_date: '',
  creative_lifespan_days: '', hook_rate: '', hold_rate: '', uctr: '', cvr: '',
  cpl: '', cpl_label: 'CPL', next_action: '',
};

// Map constants into CustomSelect option shapes
const signalOptions = AD_SIGNALS.map((s) => ({ value: s.value, label: s.label }));
const angleFamilyOptions = AD_ANGLE_FAMILIES.map((af) => ({ value: af.value, label: af.label, description: af.description }));
const angleIdeaOptions = AD_ANGLE_IDEAS.map((ai) => ({ value: ai.value, label: ai.label }));
const creativeStyleOptions = AD_CREATIVE_STYLES.map((cs) => ({ value: cs.value, label: cs.label }));
const creativeFormatOptions = AD_CREATIVE_FORMATS.map((cf) => ({ value: cf.value, label: cf.label }));
const awarenessOptions = AWARENESS_LEVELS.map((al) => ({ value: al.value, label: al.label, description: al.description }));
const sophisticationOptions = MARKET_SOPHISTICATION_LEVELS.map((ms) => ({ value: ms.value, label: ms.label, description: ms.description }));
const iterationOptions = AD_ITERATION_TYPES.map((t) => ({ value: t.value, label: t.label }));
const mediaOptions = AD_MEDIA_TYPES.map((t) => ({ value: t.value, label: t.label }));

const META_CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'Apply Now', label: 'Apply Now' },
  { value: 'Book Now', label: 'Book Now' },
  { value: 'Contact Us', label: 'Contact Us' },
  { value: 'Download', label: 'Download' },
  { value: 'Get Offer', label: 'Get Offer' },
  { value: 'Get Quote', label: 'Get Quote' },
  { value: 'Get Showtimes', label: 'Get Showtimes' },
  { value: 'Learn More', label: 'Learn More' },
  { value: 'Listen Now', label: 'Listen Now' },
  { value: 'Order Now', label: 'Order Now' },
  { value: 'Request Time', label: 'Request Time' },
  { value: 'See Menu', label: 'See Menu' },
  { value: 'Send Message', label: 'Send Message' },
  { value: 'Shop Now', label: 'Shop Now' },
  { value: 'Sign Up', label: 'Sign Up' },
  { value: 'Subscribe', label: 'Subscribe' },
  { value: 'Watch More', label: 'Watch More' },
  { value: 'WhatsApp Message', label: 'WhatsApp Message' },
];

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

function Section({ title, children }: {
  title: string; open?: boolean; onToggle?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-surface/50">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
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
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editingId);
  const [error, setError] = useState<string | null>(null);
  const [referenceTab, setReferenceTab] = useState<TabType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [targetMarketOptions, setTargetMarketOptions] = useState<{ value: string; label: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch target market options
  useEffect(() => {
    (async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/ads/target-markets?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setTargetMarketOptions(json.data.map((m: { name: string }) => ({ value: m.name, label: m.name })));
      }
    })();
  }, [companyId]);

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
      ad_copy_link: c.ad_copy_link || '',
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

  // ─── Image upload (direct to Supabase, bypasses Vercel payload limit) ─────
  const handleFileUpload = async (file: File) => {
    if (!editingId) return;

    // 50MB limit for videos
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
    ];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Accepted: JPEG, PNG, WebP, GIF, MP4, MOV, WebM');
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop() || 'bin';
    const path = `ad-creatives/${companyId}/${editingId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error('Ad creative upload error:', uploadError);
      setError('Upload failed');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    // Update the creative's image_url in the database
    const { error: updateError } = await supabase
      .from('ad_creatives')
      .update({ image_url: urlData.publicUrl })
      .eq('id', editingId)
      .eq('company_id', companyId);

    setUploading(false);

    if (updateError) {
      console.error('Update image_url error:', updateError);
      setError('Uploaded but failed to save URL');
      return;
    }

    setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  // ─── Copy variants ────────────────────────────────────────────────────────
  const VARIANT_GROUPS: { type: AdCopyVariantType; title: string; prefix: string }[] = [
    { type: 'headline', title: 'Headline', prefix: 'H' },
    { type: 'primary_text', title: 'Primary Text', prefix: 'P' },
    { type: 'description', title: 'Description', prefix: 'D' },
    { type: 'cta', title: 'CTA', prefix: 'CTA' },
  ];

  const addVariant = (type: AdCopyVariantType) => {
    const group = VARIANT_GROUPS.find((g) => g.type === type)!;
    const count = variants.filter((v) => v.variant_type === type).length;
    const num = String(count + 1).padStart(2, '0');
    setVariants((prev) => [
      ...prev,
      { variant_type: type, label: `${group.prefix}${num}`, content: '' },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-number labels within each type group
      const counts: Record<string, number> = {};
      return updated.map((v) => {
        const group = VARIANT_GROUPS.find((g) => g.type === v.variant_type);
        if (!group) return v;
        counts[v.variant_type] = (counts[v.variant_type] || 0) + 1;
        return { ...v, label: `${group.prefix}${String(counts[v.variant_type]).padStart(2, '0')}` };
      });
    });
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
      ad_copy_link: form.ad_copy_link || null,
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


  const isVideo = form.image_url && /\.(mp4|mov|webm)$/i.test(form.image_url);

  return (
    <div className="bg-white w-full flex flex-col h-full">
        {/* Header — title + reference tabs in one row */}
        <div className="shrink-0 border-b border-edge flex items-center px-6 py-3 gap-4">
          <button
            type="button"
            onClick={() => setReferenceTab(null)}
            className={`text-[13px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${
              !referenceTab
                ? 'bg-teal/10 text-teal'
                : 'text-muted hover:text-ink hover:bg-edge/50'
            }`}
          >
            {editingId ? 'Edit Creative' : 'New Creative'}
          </button>
          <div className="w-px h-5 bg-edge" />
          {(['angles', 'formats', 'awareness', 'sophistication'] as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setReferenceTab(referenceTab === tab ? null : tab)}
              className={`text-[13px] font-medium whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${
                referenceTab === tab
                  ? 'bg-teal/10 text-teal'
                  : 'text-muted hover:text-ink hover:bg-edge/50'
              }`}
            >
              {tab === 'angles' ? 'Angles Menu' : tab === 'formats' ? 'Creative Formats' : tab === 'awareness' ? 'Awareness Levels' : 'Market Sophistication'}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Reference panel — replaces the form area when active */}
        {referenceTab ? (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 border-b border-edge bg-surface/30 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">
                {referenceTab === 'angles' ? 'Angles Menu' : referenceTab === 'formats' ? 'Creative Formats' : referenceTab === 'awareness' ? 'Awareness Levels' : 'Market Sophistication'}
              </span>
              <button
                type="button"
                onClick={() => setReferenceTab(null)}
                className="text-[12px] font-medium text-teal hover:text-teal-hover transition-colors"
              >
                Back to Form
              </button>
            </div>
            <div className="px-6 py-6">
              <ReferenceTabContent type={referenceTab} />
            </div>
          </div>
        ) : loadingEdit ? (
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
                <Field label="Ad Name *" hint="Use the naming convention e.g. MIRROR - C01 - H01 - D01 - IMG01.a">
                  <input
                    type="text"
                    value={form.ad_name}
                    onChange={(e) => updateField('ad_name', e.target.value)}
                    placeholder="Use the naming convention"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Ad Concept" hint="What is the overall idea of the ad in 1-2 sentences?">
                  <textarea value={form.ad_concept} onChange={(e) => updateField('ad_concept', e.target.value)} placeholder="Overall idea of the ad in 1-2 sentences" rows={2} className={inputClass + ' resize-none'} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Status" hint="What is the status of the ad?">
                    <CustomSelect
                      value={form.status}
                      options={statusOptions}
                      onChange={(v) => updateField('status', v)}
                      placeholder="Select..."
                      clearable={false}
                    />
                  </Field>
                  <Field label="Type" hint="New ad or iteration on a winning ad">
                    <CustomSelect
                      value={form.iteration_type}
                      options={iterationOptions}
                      onChange={(v) => updateField('iteration_type', v)}
                      placeholder="Select..."
                    />
                  </Field>
                  <Field label="Media" hint="Still image or video">
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

            {/* ─── 2-Column Grid ────────────────────────────────────────────── */}
            <div className="p-6 grid grid-cols-2 gap-4">
              {/* Strategy (left) */}
              <Section title="Strategy">
                <Field label="Signal" hint="Where does the data come from? Can choose multiple">
                  <CustomSelect
                    value={form.signal}
                    options={signalOptions}
                    onChange={(v) => updateField('signal', v)}
                    placeholder="Where does the data come from?"
                  />
                </Field>
                <Field label="Hypothesis" hint="A good hypothesis links one data insight to one predicted ad outcome">
                  <textarea value={form.hypothesis} onChange={(e) => updateField('hypothesis', e.target.value)} placeholder="Links one data insight to one predicted ad outcome" rows={2} className={inputClass + ' resize-none'} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Angle Family" hint="See the reference sheet if unsure">
                    <CustomSelect
                      value={form.angle_family}
                      options={angleFamilyOptions}
                      onChange={(v) => updateField('angle_family', v)}
                      placeholder="Select angle..."
                    />
                  </Field>
                  <Field label="Angle Idea" hint="Choose a categorisation for easy data analysis. Can also help for brainstorming">
                    <CustomSelect
                      value={form.angle_idea}
                      options={angleIdeaOptions}
                      onChange={(v) => updateField('angle_idea', v)}
                      placeholder="Select idea..."
                      searchable
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Angles Menu" onClick={() => setReferenceTab(referenceTab === 'angles' ? null : 'angles')} />
                </div>
              </Section>

              {/* Audience (right) */}
              <Section title="Audience">
                <Field label="Target Market" hint="Who is the ad targeting? Select or type a custom market">
                  <CustomSelect
                    value={form.target_market}
                    options={targetMarketOptions}
                    onChange={(v) => updateField('target_market', v)}
                    placeholder="Select or type a market..."
                    searchable
                    creatable
                  />
                </Field>
                <Field label="Awareness Level" hint="Choose which stage they are at">
                  <CustomSelect
                    value={form.awareness_level}
                    options={awarenessOptions}
                    onChange={(v) => updateField('awareness_level', v)}
                    placeholder="Select level..."
                  />
                </Field>
                <Field label="Market Sophistication" hint="Choose which stage they are at">
                  <CustomSelect
                    value={form.market_sophistication}
                    options={sophisticationOptions}
                    onChange={(v) => updateField('market_sophistication', v)}
                    placeholder="Select level..."
                  />
                </Field>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Awareness Levels" onClick={() => setReferenceTab(referenceTab === 'awareness' ? null : 'awareness')} />
                  <ReferenceLink label="Market Sophistication" onClick={() => setReferenceTab(referenceTab === 'sophistication' ? null : 'sophistication')} />
                </div>
              </Section>

              {/* Destination (left) */}
              <Section title="Destination">
                <Field label="Offer Variant" hint="Which offer will the ad go to?">
                  <input type="text" value={form.offer_variant} onChange={(e) => updateField('offer_variant', e.target.value)} placeholder="Which offer will the ad go to?" className={inputClass} />
                </Field>
                <Field label="Lander Variant" hint="Which landing page will the ad go to?">
                  <input type="text" value={form.lander_variant} onChange={(e) => updateField('lander_variant', e.target.value)} placeholder="Which landing page?" className={inputClass} />
                </Field>
              </Section>

              {/* Execution (right) */}
              <Section title="Execution">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Creative Style" hint="How the platform reads the type of creative">
                    <CustomSelect
                      value={form.creative_style}
                      options={creativeStyleOptions}
                      onChange={(v) => updateField('creative_style', v)}
                      placeholder="Select style..."
                    />
                  </Field>
                  <Field label="Creative Format" hint="Helps with brainstorming and data analysis">
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
                  <Field label="Video Hooks" hint="What is the hook of the video?">
                    <input type="text" value={form.video_hooks} onChange={(e) => updateField('video_hooks', e.target.value)} placeholder="What is the hook of the video?" className={inputClass} />
                  </Field>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Brief Link" hint="Link to the brief or task">
                    <input type="url" value={form.brief_link} onChange={(e) => updateField('brief_link', e.target.value)} placeholder="Link to brief" className={inputClass} />
                  </Field>
                  <Field label="Creative Link" hint="Canva or Frame.io link">
                    <input type="url" value={form.creative_link} onChange={(e) => updateField('creative_link', e.target.value)} placeholder="Canva or Frame.io link" className={inputClass} />
                  </Field>
                  <Field label="Ad Copy Link" hint="Google doc link">
                    <input type="url" value={form.ad_copy_link} onChange={(e) => updateField('ad_copy_link', e.target.value)} placeholder="Google doc link" className={inputClass} />
                  </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <ReferenceLink label="Creative Formats" onClick={() => setReferenceTab(referenceTab === 'formats' ? null : 'formats')} />
                </div>
              </Section>

              {/* Content (left) */}
              <Section title="Content">
                {VARIANT_GROUPS.map((group) => {
                  const match = variants.find((v) => v.variant_type === group.type);
                  const idx = match ? variants.indexOf(match) : -1;

                  if (group.type === 'cta') {
                    return (
                      <Field key={group.type} label={group.title} hint="Meta standard CTA button text">
                        <CustomSelect
                          value={match?.content || ''}
                          options={META_CTA_OPTIONS}
                          onChange={(v) => {
                            if (idx >= 0) {
                              updateVariant(idx, 'content', v);
                            } else {
                              setVariants((prev) => [
                                ...prev,
                                { variant_type: group.type, label: `${group.prefix}01`, content: v },
                              ]);
                            }
                          }}
                          placeholder="Select CTA..."
                          searchable
                        />
                      </Field>
                    );
                  }

                  return (
                    <Field key={group.type} label={group.title} hint={
                      group.type === 'headline' ? 'The main attention-grabbing line' :
                      group.type === 'primary_text' ? 'The main body copy of the ad' :
                      'Supporting text shown below the headline'
                    }>
                      <textarea
                        value={match?.content || ''}
                        onChange={(e) => {
                          if (idx >= 0) {
                            updateVariant(idx, 'content', e.target.value);
                          } else {
                            setVariants((prev) => [
                              ...prev,
                              { variant_type: group.type, label: `${group.prefix}01`, content: e.target.value },
                            ]);
                          }
                        }}
                        placeholder={`Enter ${group.title.toLowerCase()} copy...`}
                        rows={group.type === 'primary_text' ? 3 : 2}
                        className={inputClass + ' resize-none text-[12px]'}
                      />
                    </Field>
                  );
                })}
              </Section>

              {/* Results (right) */}
              <Section title="Results">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Winner?" hint="After 7 days, what was the outcome?">
                    <CustomSelect
                      value={form.winner}
                      options={winnerOptions}
                      onChange={(v) => updateField('winner', v)}
                      placeholder="Not assessed"
                    />
                  </Field>
                  <Field label="Lifespan (days)" hint="How long did the ad run for?">
                    <input type="number" value={form.creative_lifespan_days} onChange={(e) => updateField('creative_lifespan_days', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Launch Date" hint="When it went live">
                    <input type="date" value={form.launch_date} onChange={(e) => updateField('launch_date', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Analysis Date" hint="When to review performance">
                    <input type="date" value={form.analysis_date} onChange={(e) => updateField('analysis_date', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Kill Date" hint="When did we turn off the ad?">
                    <input type="date" value={form.kill_date} onChange={(e) => updateField('kill_date', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Hook Rate %" hint="% watched past 3s">
                    <input type="number" step="0.01" value={form.hook_rate} onChange={(e) => updateField('hook_rate', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Hold Rate %" hint="% watched past midpoint">
                    <input type="number" step="0.01" value={form.hold_rate} onChange={(e) => updateField('hold_rate', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="UCTR %" hint="Unique clicks / reach">
                    <input type="number" step="0.0001" value={form.uctr} onChange={(e) => updateField('uctr', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CVR" hint="Conversions / clicks">
                    <input type="number" step="0.0001" value={form.cvr} onChange={(e) => updateField('cvr', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label={form.cpl_label || 'CPL'} hint="Cost per lead or chosen metric">
                    <input type="number" step="0.01" value={form.cpl} onChange={(e) => updateField('cpl', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label="Next Action / Learning" hint="What did you learn? What's next?">
                  <textarea value={form.next_action} onChange={(e) => updateField('next_action', e.target.value)} placeholder="What did you learn? What's next?" rows={2} className={inputClass + ' resize-none'} />
                </Field>
              </Section>

              {error && <p className="col-span-2 text-[13px] text-red-600">{error}</p>}
            </div>
          </form>
        )}

        {/* Footer */}
        {!loadingEdit && !referenceTab && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-edge shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-muted bg-surface rounded-[10px] hover:bg-edge transition-colors"
            >
              Back
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
  );
}
