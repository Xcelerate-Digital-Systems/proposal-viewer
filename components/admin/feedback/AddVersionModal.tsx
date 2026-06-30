'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { FeedbackItemVersion } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant, type FeedbackStatus } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailBodyEditor from '@/components/admin/feedback/EmailBodyEditor';

import {
  type AddVersionModalProps,
  assetKindForType, fileAccept, fileTargetField,
  inputCls, RESET_OPTIONS,
  MAX_GAD_HEADLINES, MAX_GAD_DESCRIPTIONS, GAD_HEADLINE_CHARS, GAD_DESCRIPTION_CHARS,
} from './version-modal/types';
import { Field } from './version-modal/Field';
import { FileInput } from './version-modal/FileInput';
import { CtaDropdown } from './version-modal/CtaDropdown';
import { AssetListField } from './version-modal/AssetListField';
import { VersionVariationPanel } from './version-modal/VersionVariationPanel';
import { useAdVariations } from './version-modal/useAdVariations';

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

  // Ad variation state (hook)
  const {
    variations, setVariations,
    activeVariationId, setActiveVariationId,
    loadingVariations, selectedVariations, activeVariation,
    toggleVariation, patchVariation, addNewVariation, removeVariation,
    originalExistingRef,
  } = useAdVariations(item, kind);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
