'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Plus, Trash2, Type, AlignLeft, Check, ChevronDown, GripVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { FeedbackItem, FeedbackItemVersion } from '@/lib/supabase';
import type { VersionView } from '@/lib/feedback/versions';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant, type FeedbackStatus } from '@/lib/types/feedback';
import type { AdCopyVariation } from '@/lib/types/feedback';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailBodyEditor from '@/components/admin/feedback/EmailBodyEditor';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

/* ─── Shared helpers ──────────────────────────────────────────────── */

function newVariantId(): string { return crypto.randomUUID().slice(0, 8); }
function newAdVariant(): MetaAdVariant { return { id: newVariantId(), label: '', primary_text: '', headline: '' }; }

type PickerVariation = {
  id: string; label: string; headline: string; primary_text: string;
  isExisting: boolean; selected: boolean; usedByCount?: number;
};

function newTempVariation(): PickerVariation {
  return { id: `new-${crypto.randomUUID().slice(0, 8)}`, label: '', headline: '', primary_text: '', isExisting: false, selected: true };
}

const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

const MAX_GAD_HEADLINES = 15;
const MAX_GAD_DESCRIPTIONS = 4;
const GAD_HEADLINE_CHARS = 30;
const GAD_DESCRIPTION_CHARS = 90;

/* ─── Types ───────────────────────────────────────────────────────── */

interface AddVersionModalProps {
  item: FeedbackItem;
  nextVersionNumber: number;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: {
    notes?: string | null;
    assets: Partial<FeedbackItemVersion>;
    resetToStage?: FeedbackStatus | null;
  }) => Promise<FeedbackItemVersion | null>;
  onUploadAsset: (file: File) => Promise<string | null>;
  editingVersion?: VersionView;
  onUpdate?: (
    versionId: string | null,
    patch: { notes?: string | null; assets: Partial<FeedbackItemVersion> }
  ) => Promise<boolean>;
}

type AssetKind = 'file' | 'text' | 'ad' | 'google_search_ad' | 'google_banner_ad' | 'meta_lead_form';

function assetKindForType(type: FeedbackItem['type']): AssetKind {
  if (type === 'email' || type === 'sms') return 'text';
  if (type === 'ad') return 'ad';
  if (type === 'google_search_ad') return 'google_search_ad';
  if (type === 'google_banner_ad') return 'google_banner_ad';
  if (type === 'meta_lead_form') return 'meta_lead_form';
  return 'file';
}

function fileAccept(type: FeedbackItem['type']): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'pdf') return 'application/pdf';
  if (type === 'ad' || type === 'google_banner_ad' || type === 'meta_lead_form') return 'image/*';
  return '*';
}

function fileTargetField(type: FeedbackItem['type']): keyof FeedbackItemVersion {
  if (type === 'image') return 'image_url';
  if (type === 'video') return 'video_url';
  if (type === 'pdf') return 'pdf_url';
  return 'ad_creative_url';
}

/* ─── Main component ──────────────────────────────────────────────── */

export default function AddVersionModal({
  item, nextVersionNumber, creating, onClose, onSubmit, onUploadAsset,
  editingVersion, onUpdate,
}: AddVersionModalProps) {
  const toast = useToast();
  const kind = assetKindForType(item.type);
  const isEditing = !!editingVersion;
  const seed = editingVersion?.assets ?? item;

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState(editingVersion?.notes ?? '');

  // Text variants
  const [emailSubject, setEmailSubject] = useState(seed.email_subject ?? '');
  const [emailPreheader, setEmailPreheader] = useState(seed.email_preheader ?? '');
  const [emailBody, setEmailBody] = useState(seed.email_body ?? '');
  const [smsBody, setSmsBody] = useState(seed.sms_body ?? '');

  // Meta ad copy
  const [adCta, setAdCta] = useState(seed.ad_cta ?? 'Learn More');
  const [adPlatform] = useState<AdPlatform>((item.ad_platform as AdPlatform) || 'facebook_feed');

  // Variation picker state
  const [variations, setVariations] = useState<PickerVariation[]>([]);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalExistingRef = useRef<Map<string, { label: string; headline: string; primary_text: string }>>(new Map());

  // Load existing creative preview for the current item
  const currentCreativeUrl = seed.ad_creative_url || item.ad_creative_url || null;

  // Generate file preview
  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setFilePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setFile(selected);
  };

  // Fetch campaign variations + current item links via the API (handles super-admin auth)
  useEffect(() => {
    if (kind !== 'ad') return;
    let cancelled = false;
    setLoadingVariations(true);
    (async () => {
      const res = await authFetch(`/api/campaigns/${item.review_project_id}/ad-variations?company_id=${item.company_id}`);
      if (cancelled || !res.ok) { setLoadingVariations(false); return; }
      const { variations: existingVariations, links } = await res.json() as {
        variations: AdCopyVariation[];
        links: { review_item_id: string; ad_copy_variation_id: string }[];
      };

      const usageCounts: Record<string, number> = {};
      for (const l of links) {
        usageCounts[l.ad_copy_variation_id] = (usageCounts[l.ad_copy_variation_id] ?? 0) + 1;
      }

      // Which variations are currently linked to THIS item
      const linkedIds = new Set(
        links.filter((l) => l.review_item_id === item.id).map((l) => l.ad_copy_variation_id)
      );

      const picker: PickerVariation[] = existingVariations
        .filter((v) => v.headline.trim() || v.primary_text.trim())
        .map((v) => ({
          id: v.id,
          label: v.label || '',
          headline: v.headline,
          primary_text: v.primary_text,
          isExisting: true,
          selected: linkedIds.has(v.id),
          usedByCount: usageCounts[v.id] || 0,
        }));

      // Snapshot for edit detection
      const snap = new Map<string, { label: string; headline: string; primary_text: string }>();
      for (const v of picker) snap.set(v.id, { label: v.label, headline: v.headline, primary_text: v.primary_text });
      originalExistingRef.current = snap;

      if (!cancelled) {
        setVariations(picker.length > 0 ? picker : [newTempVariation()]);
        const firstSelected = picker.find((v) => v.selected);
        if (firstSelected) setActiveVariationId(firstSelected.id);
        else if (picker.length > 0) setActiveVariationId(picker[0].id);
        setLoadingVariations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id, item.review_project_id, kind]);

  const selectedVariations = variations.filter((v) => v.selected);
  const activeVariation = selectedVariations.find((v) => v.id === activeVariationId)
    ?? selectedVariations[0] ?? null;

  const toggleVariation = (id: string) => {
    setVariations((prev) => prev.map((v) => v.id === id ? { ...v, selected: !v.selected } : v));
  };

  const patchVariation = (id: string, patch: Partial<PickerVariation>) =>
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addNewVariation = () => {
    const v = newTempVariation();
    setVariations((prev) => [...prev, v]);
    setActiveVariationId(v.id);
  };

  const removeVariation = (id: string) => {
    setVariations((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
      if (!v.isExisting) {
        const next = prev.filter((x) => x.id !== id);
        if (activeVariationId === id) {
          const firstSelected = next.find((x) => x.selected);
          if (firstSelected) setActiveVariationId(firstSelected.id);
        }
        return next;
      }
      return prev.map((x) => x.id === id ? { ...x, selected: false } : x);
    });
  };

  // Google ad state
  const gad = seed.google_ad_data ?? item.google_ad_data ?? null;
  const [gadHeadlines, setGadHeadlines] = useState<string[]>(() => {
    const seeded = (gad?.headlines || []).filter((h) => typeof h === 'string');
    return seeded.length ? seeded.slice(0, MAX_GAD_HEADLINES) : [''];
  });
  const [gadDescriptions, setGadDescriptions] = useState<string[]>(() => {
    const seeded = (gad?.descriptions || []).filter((d) => typeof d === 'string');
    return seeded.length ? seeded.slice(0, MAX_GAD_DESCRIPTIONS) : [''];
  });
  const [gadFinalUrl, setGadFinalUrl] = useState(gad?.final_url ?? '');

  const updateHeadline = (idx: number, value: string) =>
    setGadHeadlines((prev) => prev.map((h, i) => (i === idx ? value.slice(0, GAD_HEADLINE_CHARS) : h)));
  const addHeadline = () =>
    gadHeadlines.length < MAX_GAD_HEADLINES && setGadHeadlines((prev) => [...prev, '']);
  const removeHeadline = (idx: number) =>
    setGadHeadlines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateDescription = (idx: number, value: string) =>
    setGadDescriptions((prev) => prev.map((d, i) => (i === idx ? value.slice(0, GAD_DESCRIPTION_CHARS) : d)));
  const addDescription = () =>
    gadDescriptions.length < MAX_GAD_DESCRIPTIONS && setGadDescriptions((prev) => [...prev, '']);
  const removeDescription = (idx: number) =>
    setGadDescriptions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  // Meta lead form
  const lf = seed.meta_lead_form_data ?? item.meta_lead_form_data;
  const [lfHeadline, setLfHeadline] = useState(lf?.intro_headline ?? '');
  const [lfDescription, setLfDescription] = useState(lf?.intro_description ?? '');
  const [lfCta, setLfCta] = useState(lf?.cta ?? 'Continue');

  const [uploading, setUploading] = useState(false);
  const busy = uploading || creating;

  const RESET_OPTIONS: { value: FeedbackStatus | 'keep'; label: string }[] = [
    { value: 'client_review', label: 'Send to Client Review' },
    { value: 'internal_review', label: 'Send to Internal Review' },
    { value: 'keep', label: 'Keep current stage' },
  ];
  const [resetTo, setResetTo] = useState<FeedbackStatus | 'keep'>('client_review');

  /* ── Submit ── */
  const handleSubmit = async () => {
    setUploading(true);
    const assets: Partial<FeedbackItemVersion> = {};

    try {
      if (kind === 'file') {
        if (!file && !isEditing) { toast.error('Choose a file'); setUploading(false); return; }
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          (assets as Record<string, unknown>)[fileTargetField(item.type) as string] = url;
        }
      }

      if (kind === 'text') {
        if (item.type === 'email') {
          if (!emailBody.trim()) { toast.error('Body is required'); setUploading(false); return; }
          assets.email_subject = emailSubject || null;
          assets.email_preheader = emailPreheader || null;
          assets.email_body = emailBody;
        } else {
          if (!smsBody.trim()) { toast.error('Body is required'); setUploading(false); return; }
          assets.sms_body = smsBody;
        }
      }

      if (kind === 'ad') {
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          assets.ad_creative_url = url;
        }

        // Patch any existing variations whose copy was edited
        for (const v of variations.filter((v) => v.isExisting && v.selected)) {
          const orig = originalExistingRef.current.get(v.id);
          if (!orig) continue;
          if (orig.label !== v.label || orig.headline !== v.headline || orig.primary_text !== v.primary_text) {
            authFetch(`/api/campaigns/${item.review_project_id}/ad-variations?company_id=${item.company_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variation_id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim() }),
            }).catch(() => {});
          }
        }

        // Build variant array from selected variations
        const selected = variations.filter((v) => v.selected);
        const cleanVariants: MetaAdVariant[] = selected
          .map((v) => ({
            id: v.id,
            label: v.label.trim() || null,
            headline: v.headline.trim(),
            primary_text: v.primary_text.trim(),
          }))
          .filter((v) => v.headline || v.primary_text);
        const first = cleanVariants[0];
        assets.ad_headline = first?.headline || null;
        assets.ad_copy = first?.primary_text || null;
        assets.ad_cta = adCta || null;
        assets.ad_platform = item.ad_platform;
        assets.meta_ad_variants = cleanVariants.length > 0 ? cleanVariants : null;

        // After version save, update the junction links + create new variations
        // via the API. This is fire-and-forget since the version is already saved.
        setTimeout(async () => {
          try {
            const { authFetch } = await import('@/lib/auth-fetch');
            const existingIds = selected.filter((v) => v.isExisting).map((v) => v.id);
            const newVars = selected
              .filter((v) => !v.isExisting)
              .map((v) => ({ label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim() }))
              .filter((v) => v.headline || v.primary_text);

            let allIds = [...existingIds];
            if (newVars.length > 0) {
              const res = await authFetch(`/api/campaigns/${item.review_project_id}/ad-variations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variations: newVars }),
              });
              if (res.ok) {
                const { variations: created } = await res.json();
                allIds = [...allIds, ...created.map((v: { id: string }) => v.id)];
              }
            }
            if (allIds.length > 0) {
              await authFetch(`/api/campaigns/${item.review_project_id}/ad-variations/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review_item_id: item.id, variation_ids: allIds }),
              });
            }
          } catch { /* non-fatal */ }
        }, 0);
      }

      if (kind === 'meta_lead_form') {
        if (!lf) { toast.error('Lead form not configured'); setUploading(false); return; }
        let coverUrl = lf.cover_url;
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          coverUrl = url;
        }
        assets.meta_lead_form_data = { ...lf, cover_url: coverUrl, intro_headline: lfHeadline, intro_description: lfDescription, cta: lfCta };
      }

      if (kind === 'google_search_ad') {
        const base = item.google_ad_data;
        if (!base) { toast.error('Base ad not configured'); setUploading(false); return; }
        const headlines = gadHeadlines.map((h) => h.trim()).filter(Boolean);
        if (headlines.length === 0) { toast.error('At least one headline is required'); setUploading(false); return; }
        assets.google_ad_data = { ...base, final_url: gadFinalUrl.trim() || base.final_url, headlines, descriptions: gadDescriptions.map((d) => d.trim()).filter(Boolean) };
      }

      if (kind === 'google_banner_ad') {
        const base = item.google_ad_data;
        if (!base) { toast.error('Base ad not configured'); setUploading(false); return; }
        let bannerImageUrl = base.banner_image_url;
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          bannerImageUrl = url;
          assets.ad_creative_url = url;
        }
        assets.google_ad_data = { ...base, final_url: gadFinalUrl.trim() || base.final_url, headlines: [(gadHeadlines[0]?.trim() || base.headlines[0] || '')], banner_image_url: bannerImageUrl };
      }

      if (isEditing && onUpdate && editingVersion) {
        const ok = await onUpdate(editingVersion.id, { notes: notes.trim() || null, assets });
        if (ok) onClose();
      } else {
        const result = await onSubmit({ notes: notes.trim() || null, assets, resetToStage: resetTo === 'keep' ? null : resetTo });
        if (result) onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  const modalTitle = isEditing
    ? `Edit Version ${editingVersion?.versionNumber ?? ''}`
    : `New Version ${nextVersionNumber}`;

  /* ── Meta Ad: Full-width two-column layout ── */
  if (kind === 'ad') {
    const previewUrl = filePreview || currentCreativeUrl;
    const mockupVariants: MetaAdVariant[] = selectedVariations.map((v) => ({
      id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim(),
    }));

    return (
      <Modal open onClose={onClose} size="full">
        <Modal.Header>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-ink">{modalTitle}</h3>
              <p className="text-xs text-dim mt-0.5 truncate max-w-[360px]">{item.title}</p>
            </div>
            <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
          </div>
        </Modal.Header>

        <div className="flex-1 min-h-0 flex">
          {/* LEFT: Creative + CTA + Preview */}
          <div className="w-[420px] shrink-0 border-r border-edge-strong flex flex-col overflow-y-auto">
            <div className="p-5 space-y-4 flex-1">
              {/* Creative image */}
              <div>
                <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">
                  Creative Image
                </label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {previewUrl ? (
                  <div className="rounded-2xl border border-edge-strong bg-white overflow-hidden">
                    <img src={previewUrl} alt="Creative" loading="lazy" className="w-full aspect-square object-cover" />
                    <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-edge">
                      <p className="text-detail text-faint truncate">{file ? file.name : 'Current creative'}</p>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-detail font-semibold text-teal hover:text-teal-hover shrink-0">
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-square border-2 border-dashed border-edge-strong rounded-2xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors">
                    <Upload size={24} className="text-faint mb-2" />
                    <p className="text-xs font-medium text-prose">Upload new creative</p>
                    <p className="text-2xs text-faint mt-1">1:1 recommended · max 10MB</p>
                  </button>
                )}
              </div>

              <CtaDropdown value={adCta} onChange={(v) => {/* adCta is const for version — CTA lives on the item */}} disabled />

              {/* Live preview */}
              {previewUrl && mockupVariants.length > 0 && (
                <div className="pt-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-dim mb-2">Preview</p>
                  <div className="transform scale-[0.65] origin-top-left" style={{ width: '154%' }}>
                    <AdMockupPreview
                      creativeUrl={previewUrl}
                      ctaText={adCta}
                      platform={adPlatform}
                      pageName="Your Brand"
                      showPlatformToggle={false}
                      variants={mockupVariants}
                      activeVariantId={activeVariation?.id}
                      onVariantChange={(id) => setActiveVariationId(id)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Copy Variations */}
          <VersionVariationPanel
            variations={variations}
            setVariations={setVariations}
            activeVariationId={activeVariation?.id ?? null}
            setActiveVariationId={setActiveVariationId}
            toggleVariation={toggleVariation}
            patchVariation={patchVariation}
            addNewVariation={addNewVariation}
            removeVariation={removeVariation}
            loadingVariations={loadingVariations}
            notes={notes}
            setNotes={setNotes}
            isEditing={isEditing}
            resetTo={resetTo}
            setResetTo={setResetTo}
            RESET_OPTIONS={RESET_OPTIONS}
          />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-edge-strong px-5 py-3 flex items-center justify-between bg-white">
          <span className="text-detail text-faint">
            {selectedVariations.length} variation{selectedVariations.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button size="sm" loading={busy} leftIcon={Upload} onClick={handleSubmit}>
              {isEditing ? 'Save Changes' : 'Save Version'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  /* ── Non-ad types: standard modal ── */
  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">{modalTitle}</h3>
            <p className="text-xs text-dim mt-0.5 truncate max-w-[360px]">{item.title}</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {kind === 'file' && <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional={isEditing} />}

        {kind === 'text' && item.type === 'email' && (
          <>
            <Field label="Subject"><input className={inputCls} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} /></Field>
            <Field label="Preheader"><input className={inputCls} value={emailPreheader} onChange={(e) => setEmailPreheader(e.target.value)} /></Field>
            <Field label="Body"><EmailBodyEditor content={emailBody} onChange={setEmailBody} /></Field>
          </>
        )}

        {kind === 'text' && item.type === 'sms' && (
          <Field label="Body"><textarea className={`${inputCls} min-h-[120px]`} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} /></Field>
        )}

        {kind === 'meta_lead_form' && (
          <>
            <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
            <Field label="Intro headline"><input className={inputCls} value={lfHeadline} onChange={(e) => setLfHeadline(e.target.value)} /></Field>
            <Field label="Intro description"><textarea className={`${inputCls} min-h-[80px]`} value={lfDescription} onChange={(e) => setLfDescription(e.target.value)} /></Field>
            <Field label="CTA button"><input className={inputCls} value={lfCta} onChange={(e) => setLfCta(e.target.value)} /></Field>
            <p className="text-detail text-dim -mt-1">To edit questions or other pages, edit the item directly.</p>
          </>
        )}

        {kind === 'google_search_ad' && (
          <>
            <p className="text-detail text-dim -mt-1">Versions iterate on headlines and descriptions. Sitelinks, paths, and call extension stay from the base item.</p>
            <AssetListField label="Headlines" items={gadHeadlines} max={MAX_GAD_HEADLINES} charLimit={GAD_HEADLINE_CHARS} onUpdate={updateHeadline} onAdd={addHeadline} onRemove={removeHeadline} addLabel="Add headline" />
            <AssetListField label="Descriptions" items={gadDescriptions} max={MAX_GAD_DESCRIPTIONS} charLimit={GAD_DESCRIPTION_CHARS} onUpdate={updateDescription} onAdd={addDescription} onRemove={removeDescription} addLabel="Add description" multiline />
            <Field label="Final URL"><input className={inputCls} value={gadFinalUrl} onChange={(e) => setGadFinalUrl(e.target.value)} /></Field>
          </>
        )}

        {kind === 'google_banner_ad' && (
          <>
            <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
            <Field label="Headline"><input className={inputCls} value={gadHeadlines[0] ?? ''} onChange={(e) => updateHeadline(0, e.target.value)} /></Field>
            <Field label="Final URL"><input className={inputCls} value={gadFinalUrl} onChange={(e) => setGadFinalUrl(e.target.value)} /></Field>
          </>
        )}

        <Field label="Version notes (optional)">
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. tightened copy, swapped hero shot" />
        </Field>

        {!isEditing && (
          <Field label="After upload">
            <div className="flex items-center gap-2">
              <select className={`${inputCls} flex-1`} value={resetTo} onChange={(e) => setResetTo(e.target.value as FeedbackStatus | 'keep')}>
                {RESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {resetTo !== 'keep' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${getFeedbackStatusDef(resetTo).bg} ${getFeedbackStatusDef(resetTo).text} ${getFeedbackStatusDef(resetTo).border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getFeedbackStatusDef(resetTo).dot}`} />
                  {getFeedbackStatusDef(resetTo).label}
                </span>
              )}
            </div>
            <p className="text-detail text-faint mt-1">Reviewers assigned to the next stage will be notified automatically.</p>
          </Field>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="sm" loading={busy} leftIcon={Upload} onClick={handleSubmit}>
          {isEditing ? 'Save Changes' : 'Save Version'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/* ─── Shared sub-components ───────────────────────────────────────── */

const inputCls = 'w-full px-3 py-2 bg-surface rounded-2xl text-caption focus:outline-none focus:ring-2 focus:ring-teal/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-detail font-medium uppercase tracking-wider text-dim mb-1 block">{label}</span>
      {children}
    </label>
  );
}

/* ─── Version Variation Panel with DnD ───────────────────────────── */

function VersionVariationPanel({
  variations, setVariations, activeVariationId, setActiveVariationId,
  toggleVariation, patchVariation, addNewVariation, removeVariation, loadingVariations,
  notes, setNotes, isEditing, resetTo, setResetTo, RESET_OPTIONS,
}: {
  variations: PickerVariation[];
  setVariations: React.Dispatch<React.SetStateAction<PickerVariation[]>>;
  activeVariationId: string | null;
  setActiveVariationId: (id: string | null) => void;
  toggleVariation: (id: string) => void;
  patchVariation: (id: string, patch: Partial<PickerVariation>) => void;
  addNewVariation: () => void;
  removeVariation: (id: string) => void;
  loadingVariations: boolean;
  notes: string;
  setNotes: (v: string) => void;
  isEditing: boolean;
  resetTo: FeedbackStatus | 'keep';
  setResetTo: (v: FeedbackStatus | 'keep') => void;
  RESET_OPTIONS: { value: FeedbackStatus | 'keep'; label: string }[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const existingVars = variations.filter((v) => v.isExisting);
  const newVars = variations.filter((v) => !v.isExisting);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setVariations((prev) => {
      const oldIdx = prev.findIndex((v) => v.id === active.id);
      const newIdx = prev.findIndex((v) => v.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleToggleExpand = (id: string, isExisting: boolean) => {
    if (isExisting) {
      const v = variations.find((x) => x.id === id);
      if (!v?.selected) toggleVariation(id);
    }
    if (activeVariationId === id) {
      setActiveVariationId(null);
    } else {
      setActiveVariationId(id);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-dim uppercase tracking-wider">Copy Variations</label>
          <button type="button" onClick={addNewVariation} className="inline-flex items-center gap-1 text-detail font-semibold text-teal hover:text-teal-hover">
            <Plus size={12} /> New variation
          </button>
        </div>
        <p className="text-detail text-faint mb-4">
          Select existing variations or create new ones. Drag to reorder.
        </p>

        {loadingVariations && (
          <div className="flex items-center gap-2 text-detail text-faint py-2">
            <div className="w-3 h-3 border border-faint border-t-teal rounded-full animate-spin" />
            Loading…
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={variations.map((v) => v.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {existingVars.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-dim">Existing in this campaign</p>
                  {existingVars.map((v) => (
                    <SortableExistingVariationRow
                      key={v.id}
                      variation={v}
                      isActive={activeVariationId === v.id}
                      onToggle={() => toggleVariation(v.id)}
                      onActivate={() => handleToggleExpand(v.id, true)}
                      onPatch={(patch) => patchVariation(v.id, patch)}
                    />
                  ))}
                </div>
              )}

              {newVars.length > 0 && (
                <div className="space-y-2.5">
                  {existingVars.length > 0 && (
                    <p className="text-2xs font-semibold uppercase tracking-wider text-dim mt-3">New variations</p>
                  )}
                  {newVars.map((v, i) => (
                    <SortableNewVariationEditor
                      key={v.id}
                      variation={v}
                      index={i}
                      isActive={activeVariationId === v.id}
                      onPatch={(patch) => patchVariation(v.id, patch)}
                      onActivate={() => handleToggleExpand(v.id, false)}
                      onRemove={() => removeVariation(v.id)}
                      canRemove={newVars.length > 1 || existingVars.filter((x) => x.selected).length > 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Notes + stage reset */}
        <div className="mt-6 space-y-3 border-t border-edge pt-4">
          <Field label="Version notes (optional)">
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. tightened copy, swapped hero shot" />
          </Field>
          {!isEditing && (
            <Field label="After upload">
              <div className="flex items-center gap-2">
                <select className={`${inputCls} flex-1`} value={resetTo} onChange={(e) => setResetTo(e.target.value as FeedbackStatus | 'keep')}>
                  {RESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {resetTo !== 'keep' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${getFeedbackStatusDef(resetTo).bg} ${getFeedbackStatusDef(resetTo).text} ${getFeedbackStatusDef(resetTo).border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getFeedbackStatusDef(resetTo).dot}`} />
                    {getFeedbackStatusDef(resetTo).label}
                  </span>
                )}
              </div>
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable Existing Variation Row ────────────────────────────── */

function SortableExistingVariationRow(props: {
  variation: PickerVariation; isActive: boolean; onToggle: () => void; onActivate: () => void;
  onPatch: (patch: Partial<PickerVariation>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.variation.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <ExistingVariationRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ExistingVariationRow({ variation, isActive, onToggle, onActivate, onPatch, dragHandleProps }: {
  variation: PickerVariation; isActive: boolean; onToggle: () => void; onActivate: () => void;
  onPatch: (patch: Partial<PickerVariation>) => void; dragHandleProps?: Record<string, unknown>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expanded = variation.selected && isActive;
  const displayLabel = variation.label?.trim() || variation.headline?.trim() || 'Untitled';
  const subtitle = variation.headline?.trim() ? variation.primary_text?.trim() || '' : '';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);
  useEffect(() => { if (expanded) autoResize(); }, [expanded, variation.primary_text, autoResize]);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        variation.selected
          ? (isActive ? 'border-teal/40 bg-teal/5' : 'border-teal/20 bg-white')
          : 'border-edge-strong bg-white hover:bg-surface cursor-pointer'
      }`}
      onClick={() => { if (!variation.selected) onToggle(); onActivate(); }}
    >
      <div className="flex items-center gap-2.5 p-3">
        <button type="button" className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps} onClick={(e) => e.stopPropagation()}>
          <GripVertical size={14} />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            variation.selected ? 'bg-teal border-teal text-white' : 'border-edge-hover hover:border-teal/50'
          }`}>
          {variation.selected && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          {expanded ? (
            <input type="text" value={variation.label} onChange={(e) => onPatch({ label: e.target.value })}
              placeholder="Variation name (optional)"
              className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
              onClick={(e) => e.stopPropagation()} />
          ) : (
            <p className="text-xs font-medium text-ink truncate">{displayLabel}</p>
          )}
          {!expanded && subtitle && <p className="text-detail text-faint line-clamp-2 mt-0.5">{subtitle}</p>}
        </div>
        {!expanded && (variation.usedByCount ?? 0) > 0 && (
          <span className="text-2xs text-dim shrink-0">{variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}</span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1"><AlignLeft size={10} /> Primary text</label>
            <textarea ref={textareaRef} value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }} />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1"><Type size={10} /> Headline</label>
            <input type="text" value={variation.headline} onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20" />
          </div>
          {(variation.usedByCount ?? 0) > 0 && (
            <p className="text-2xs text-dim">Changes will update this copy across {variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sortable New Variation Editor ──────────────────────────────── */

function SortableNewVariationEditor(props: {
  variation: PickerVariation; index: number; isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void; onActivate: () => void; onRemove: () => void; canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.variation.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <NewVariationEditor {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function NewVariationEditor({ variation, index, isActive, onPatch, onActivate, onRemove, canRemove, dragHandleProps }: {
  variation: PickerVariation; index: number; isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void; onActivate: () => void; onRemove: () => void; canRemove: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayLabel = variation.label?.trim() || variation.headline?.trim() || `Variation ${index + 1}`;
  const subtitle = variation.headline?.trim() ? variation.primary_text?.trim() || '' : variation.primary_text?.trim() || '';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);
  useEffect(() => { if (isActive) autoResize(); }, [isActive, variation.primary_text, autoResize]);

  return (
    <div
      className={`rounded-2xl border transition-colors ${isActive ? 'border-teal/40 bg-teal/5' : 'border-edge-strong bg-white hover:bg-surface cursor-pointer'}`}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <button type="button" className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps} onClick={(e) => e.stopPropagation()}>
          <GripVertical size={14} />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onActivate(); }}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-detail font-semibold shrink-0 transition-colors ${
            isActive ? 'bg-teal text-white' : 'bg-surface text-prose hover:bg-edge'
          }`}>{index + 1}</button>
        {isActive ? (
          <input type="text" value={variation.label} onChange={(e) => onPatch({ label: e.target.value })}
            placeholder={`Variation ${index + 1} name (optional)`}
            className="flex-1 min-w-0 bg-transparent text-caption font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
            onClick={(e) => e.stopPropagation()} />
        ) : (
          <p className="flex-1 min-w-0 text-xs font-medium text-ink truncate">{displayLabel}</p>
        )}
        {canRemove && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-faint hover:text-red-500 p-1 rounded shrink-0" title="Remove"><Trash2 size={13} /></button>
        )}
      </div>
      {!isActive && subtitle && (
        <div className="px-3 pb-3 -mt-1">
          <p className="text-detail text-faint line-clamp-2">{subtitle}</p>
        </div>
      )}
      {isActive && (
        <div className="px-3 pb-3 pt-0 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1"><AlignLeft size={10} /> Primary text</label>
            <textarea ref={textareaRef} value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }} />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1"><Type size={10} /> Headline</label>
            <input type="text" value={variation.headline} onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20" />
          </div>
        </div>
      )}
    </div>
  );
}

function CtaDropdown({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">CTA Button</label>
      <button type="button" onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-2xl text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-teal/20 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface'}`}>
        <span className="truncate">{value || 'Select CTA'}</span>
        <ChevronDown size={14} className={`text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-edge-strong shadow-lg overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto py-1">
            {CTA_OPTIONS.map((cta) => (
              <button key={cta} type="button" onClick={() => { onChange(cta); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${cta === value ? 'bg-teal/5 text-teal font-medium' : 'text-ink hover:bg-surface'}`}>
                {cta === value && <Check size={13} className="shrink-0" />}
                {cta !== value && <span className="w-[13px] shrink-0" />}
                {cta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetListField({ label, items, max, charLimit, onUpdate, onAdd, onRemove, addLabel, multiline }: {
  label: string; items: string[]; max: number; charLimit: number;
  onUpdate: (idx: number, value: string) => void; onAdd: () => void; onRemove: (idx: number) => void; addLabel: string; multiline?: boolean;
}) {
  const filled = items.filter((v) => v.trim()).length;
  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-detail font-medium uppercase tracking-wider text-dim">{label}</span>
        <span className="text-2xs tabular-nums text-faint">{filled}/{max}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((value, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 text-2xs tabular-nums text-faint w-4 text-right">{i + 1}.</span>
            {multiline
              ? <textarea className={`${inputCls} min-h-[52px]`} value={value} onChange={(e) => onUpdate(i, e.target.value)} maxLength={charLimit} />
              : <input className={inputCls} value={value} onChange={(e) => onUpdate(i, e.target.value)} maxLength={charLimit} />}
            {items.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="mt-2 p-1 text-faint hover:text-red-500 transition-colors" title="Remove"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      {items.length < max && (
        <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-xs text-teal hover:text-teal-hover font-medium"><Plus size={13} /> {addLabel}</button>
      )}
    </div>
  );
}

function FileInput({ file, onChange, accept, optional }: { file: File | null; onChange: (f: File | null) => void; accept: string; optional?: boolean }) {
  return (
    <Field label={optional ? 'New file (optional)' : 'New file'}>
      <div className="flex items-center gap-2">
        <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-caption text-prose file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-edge-strong file:text-xs file:font-medium file:bg-surface hover:file:bg-surface" />
        {file && <span className="text-detail text-dim truncate max-w-[120px]">{file.name}</span>}
      </div>
    </Field>
  );
}
