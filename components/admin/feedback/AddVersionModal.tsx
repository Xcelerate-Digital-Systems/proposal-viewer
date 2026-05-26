'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Loader2, Plus, Trash2, Type, AlignLeft, Copy, ChevronDown, Megaphone } from 'lucide-react';
import type { FeedbackItem, FeedbackItemVersion } from '@/lib/supabase';
import type { VersionView } from '@/lib/feedback/versions';
import { useToast } from '@/components/ui/Toast';
import { type MetaAdVariant, getMetaAdVariants } from '@/lib/types/feedback';
import { supabase } from '@/lib/supabase';

function newVariantId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function newAdVariant(): MetaAdVariant {
  return { id: newVariantId(), label: '', primary_text: '', headline: '' };
}

/** Shape returned by the "import variants from another ad" picker query
 *  inside the version modal. Mirrors AdItemForm's ImportableAd. */
type ImportableAd = {
  id: string;
  title: string;
  variants: MetaAdVariant[];
};

const MAX_GAD_HEADLINES = 15;
const MAX_GAD_DESCRIPTIONS = 4;
const GAD_HEADLINE_CHARS = 30;
const GAD_DESCRIPTION_CHARS = 90;

interface AddVersionModalProps {
  item: FeedbackItem;
  nextVersionNumber: number;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: {
    notes?: string | null;
    assets: Partial<FeedbackItemVersion>;
  }) => Promise<FeedbackItemVersion | null>;
  onUploadAsset: (file: File) => Promise<string | null>;
  /**
   * When provided, the modal switches to edit mode: prefills from this
   * version, hides the version-number heading, and calls `onUpdate`
   * instead of `onSubmit` to save in place.
   */
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
  return 'file'; // image, video, pdf
}

function fileAccept(type: FeedbackItem['type']): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'pdf')   return 'application/pdf';
  if (type === 'ad' || type === 'google_banner_ad' || type === 'meta_lead_form') return 'image/*';
  return '*';
}

/** Which DB column holds the uploaded URL for a given item type. */
function fileTargetField(type: FeedbackItem['type']): keyof FeedbackItemVersion {
  if (type === 'image') return 'image_url';
  if (type === 'video') return 'video_url';
  if (type === 'pdf') return 'pdf_url';
  return 'ad_creative_url';
}

export default function AddVersionModal({
  item, nextVersionNumber, creating, onClose, onSubmit, onUploadAsset,
  editingVersion, onUpdate,
}: AddVersionModalProps) {
  const toast = useToast();
  const kind = assetKindForType(item.type);

  const isEditing = !!editingVersion;
  // In edit mode, prefill from the version being edited; otherwise prefill
  // from the item (so v2 starts as a copy of v1's content).
  const seed = editingVersion?.assets ?? item;

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState(editingVersion?.notes ?? '');

  // Text variants
  const [emailSubject, setEmailSubject] = useState(seed.email_subject ?? '');
  const [emailPreheader, setEmailPreheader] = useState(seed.email_preheader ?? '');
  const [emailBody, setEmailBody] = useState(seed.email_body ?? '');
  const [smsBody, setSmsBody] = useState(seed.sms_body ?? '');

  // Meta ad copy — variants array is the source of truth. When editing a
  // legacy version with only ad_headline/ad_copy set, synthesise a single
  // starter variant so the user sees their existing copy in the editor.
  const [adCta, setAdCta] = useState(seed.ad_cta ?? '');
  const [adVariants, setAdVariants] = useState<MetaAdVariant[]>(() => {
    const stored = Array.isArray(seed.meta_ad_variants) ? seed.meta_ad_variants as MetaAdVariant[] : null;
    if (stored && stored.length > 0) return stored.map((v) => ({ ...v, label: v.label ?? '' }));
    return [{
      id: newAdVariant().id,
      label: '',
      headline: seed.ad_headline ?? '',
      primary_text: seed.ad_copy ?? '',
    }];
  });
  const patchAdVariant = (id: string, patch: Partial<MetaAdVariant>) =>
    setAdVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const addAdVariant = () => setAdVariants((prev) => [...prev, newAdVariant()]);
  const removeAdVariant = (id: string) =>
    setAdVariants((prev) => (prev.length > 1 ? prev.filter((v) => v.id !== id) : prev));

  // Import-from-ad picker — only relevant when this version is for a Meta
  // ad. Fetches other ads in the same project that have variants (or
  // legacy ad_headline/ad_copy folded into a synthesised variant) so users
  // can clone copy across ads without retyping. Mirrors AdItemForm.
  const [importableAds, setImportableAds] = useState<ImportableAd[]>([]);
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const importPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item.type !== 'ad') return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('review_items')
        .select('id, title, ad_headline, ad_copy, meta_ad_variants')
        .eq('review_project_id', item.review_project_id)
        .eq('type', 'ad')
        .neq('id', item.id)
        .order('updated_at', { ascending: false });
      if (cancelled || error || !data) return;
      const ads = data
        .map<ImportableAd>((row) => ({
          id: row.id,
          title: row.title || 'Untitled ad',
          variants: getMetaAdVariants(row).filter((v) => v.headline.trim() || v.primary_text.trim()),
        }))
        .filter((ad) => ad.variants.length > 0);
      setImportableAds(ads);
    })();
    return () => { cancelled = true; };
  }, [item.id, item.review_project_id, item.type]);

  useEffect(() => {
    if (!importPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (importPickerRef.current && !importPickerRef.current.contains(e.target as Node)) {
        setImportPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [importPickerOpen]);

  const importVariantsFromAd = (ad: ImportableAd) => {
    const cloned = ad.variants.map<MetaAdVariant>((v) => ({
      id: newVariantId(),
      label: v.label ?? '',
      headline: v.headline,
      primary_text: v.primary_text,
    }));
    setAdVariants((prev) => {
      // Replace a lone empty starter variant; otherwise append so the user
      // can stack from multiple sources.
      const hasOnlyEmptyStarter = prev.length === 1
        && !prev[0].headline.trim()
        && !prev[0].primary_text.trim();
      return hasOnlyEmptyStarter ? cloned : [...prev, ...cloned];
    });
    setImportPickerOpen(false);
    toast.success(`Imported ${cloned.length} variant${cloned.length === 1 ? '' : 's'} from “${ad.title}”`);
  };

  // Meta lead form (copy-iteration version: swap cover + edit headline/description/CTA)
  const lf = seed.meta_lead_form_data ?? item.meta_lead_form_data;
  const [lfHeadline, setLfHeadline] = useState(lf?.intro_headline ?? '');
  const [lfDescription, setLfDescription] = useState(lf?.intro_description ?? '');
  const [lfCta, setLfCta] = useState(lf?.cta ?? 'Continue');

  // Google ad — versioning lets the user iterate on the full set of headlines
  // and descriptions while keeping the base item's sitelinks, paths, and call
  // extension. For banner ads we only need a single headline (gadHeadlines[0]).
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

  const [uploading, setUploading] = useState(false);
  const busy = uploading || creating;

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
        const cleanVariants = adVariants
          .map((v) => ({
            ...v,
            label: (v.label ?? '').trim() || null,
            headline: v.headline.trim(),
            primary_text: v.primary_text.trim(),
          }))
          .filter((v) => v.headline || v.primary_text);
        const first = cleanVariants[0];
        // Mirror the first variant into the legacy columns so any downstream
        // consumer that still reads ad_headline / ad_copy directly keeps
        // working with the latest copy.
        assets.ad_headline = first?.headline || null;
        assets.ad_copy = first?.primary_text || null;
        assets.ad_cta = adCta || null;
        assets.ad_platform = item.ad_platform;
        assets.meta_ad_variants = cleanVariants.length > 0 ? cleanVariants : null;
      }

      if (kind === 'meta_lead_form') {
        if (!lf) {
          toast.error('Lead form not configured');
          setUploading(false);
          return;
        }
        let coverUrl = lf.cover_url;
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          coverUrl = url;
        }
        assets.meta_lead_form_data = {
          ...lf,
          cover_url: coverUrl,
          intro_headline: lfHeadline,
          intro_description: lfDescription,
          cta: lfCta,
        };
      }

      if (kind === 'google_search_ad') {
        const base = item.google_ad_data;
        if (!base) { toast.error('Base ad not configured'); setUploading(false); return; }
        const headlines = gadHeadlines.map((h) => h.trim()).filter(Boolean);
        const descriptions = gadDescriptions.map((d) => d.trim()).filter(Boolean);
        if (headlines.length === 0) {
          toast.error('At least one headline is required');
          setUploading(false);
          return;
        }
        assets.google_ad_data = {
          ...base,
          final_url: gadFinalUrl.trim() || base.final_url,
          headlines,
          descriptions,
        };
      }

      if (kind === 'google_banner_ad') {
        const base = item.google_ad_data;
        if (!base) { toast.error('Base ad not configured'); setUploading(false); return; }
        let bannerImageUrl = base.banner_image_url;
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          bannerImageUrl = url;
          assets.ad_creative_url = url; // keep list/card thumbnails in sync
        }
        assets.google_ad_data = {
          ...base,
          final_url: gadFinalUrl.trim() || base.final_url,
          headlines: [(gadHeadlines[0]?.trim() || base.headlines[0] || '')],
          banner_image_url: bannerImageUrl,
        };
      }

      if (isEditing && onUpdate && editingVersion) {
        const ok = await onUpdate(editingVersion.id, {
          notes: notes.trim() || null,
          assets,
        });
        if (ok) onClose();
      } else {
        const result = await onSubmit({ notes: notes.trim() || null, assets });
        if (result) onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_rgba(20,20,40,0.18)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">
              {isEditing
                ? `Edit Version ${editingVersion?.versionNumber ?? ''}`
                : `Upload Version ${nextVersionNumber}`}
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5 truncate max-w-[360px]">{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {kind === 'file' && (
            <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional={isEditing} />
          )}

          {kind === 'text' && item.type === 'email' && (
            <>
              <Field label="Subject">
                <input className={inputCls} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </Field>
              <Field label="Preheader">
                <input className={inputCls} value={emailPreheader} onChange={(e) => setEmailPreheader(e.target.value)} />
              </Field>
              <Field label="Body">
                <textarea className={`${inputCls} min-h-[120px]`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
              </Field>
            </>
          )}

          {kind === 'text' && item.type === 'sms' && (
            <Field label="Body">
              <textarea className={`${inputCls} min-h-[120px]`} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} />
            </Field>
          )}

          {kind === 'ad' && (
            <>
              <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Copy Variants
                  </label>
                  <div className="flex items-center gap-2">
                    {importableAds.length > 0 && (
                      <div className="relative" ref={importPickerRef}>
                        <button
                          type="button"
                          onClick={() => setImportPickerOpen((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-hover"
                          title="Reuse variants from another ad in this project"
                        >
                          <Copy size={12} />
                          Import from ad
                          <ChevronDown size={11} className={`transition-transform ${importPickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {importPickerOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
                            <div className="px-3 py-2 border-b border-gray-100">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                Existing ads in this project
                              </p>
                            </div>
                            <ul className="max-h-72 overflow-y-auto py-1">
                              {importableAds.map((ad) => {
                                const labels = ad.variants
                                  .map((v, i) => v.label?.trim() || `Variant ${i + 1}`)
                                  .slice(0, 4);
                                const more = ad.variants.length - labels.length;
                                return (
                                  <li key={ad.id}>
                                    <button
                                      type="button"
                                      onClick={() => importVariantsFromAd(ad)}
                                      className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                                    >
                                      <span className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Megaphone size={13} />
                                      </span>
                                      <span className="flex-1 min-w-0">
                                        <span className="flex items-center justify-between gap-2">
                                          <span className="block text-[13px] font-medium text-ink truncate">
                                            {ad.title}
                                          </span>
                                          <span className="text-[10px] text-gray-400 shrink-0">
                                            {ad.variants.length} variant{ad.variants.length === 1 ? '' : 's'}
                                          </span>
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-1">
                                          {labels.map((l, idx) => (
                                            <span
                                              key={idx}
                                              className="inline-block max-w-[140px] truncate text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                                            >
                                              {l}
                                            </span>
                                          ))}
                                          {more > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400">
                                              +{more} more
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                      <Plus size={13} className="mt-1 text-faint" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addAdVariant}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-hover"
                    >
                      <Plus size={12} />
                      Add variant
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">
                  Each variant is a (primary text, headline) pair on the same creative. Reviewers switch in the sidebar; pins scope to the active variant.
                </p>
                <ol className="space-y-2.5">
                  {adVariants.map((v, i) => (
                    <li key={v.id} className="rounded-xl border border-gray-200 bg-white">
                      <div className="flex items-center gap-2 px-3 pt-2.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 shrink-0">
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          value={v.label ?? ''}
                          onChange={(e) => patchAdVariant(v.id, { label: e.target.value })}
                          placeholder={`Variant ${i + 1} name (optional)`}
                          className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-ink placeholder:text-gray-400 placeholder:font-normal outline-none"
                        />
                        {adVariants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAdVariant(v.id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded shrink-0"
                            title="Remove variant"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="px-3 pb-3 pt-2 space-y-2">
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                            <AlignLeft size={10} /> Primary text
                          </label>
                          <textarea
                            value={v.primary_text}
                            onChange={(e) => patchAdVariant(v.id, { primary_text: e.target.value })}
                            rows={2}
                            className={`${inputCls} min-h-[52px]`}
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                            <Type size={10} /> Headline
                          </label>
                          <input
                            type="text"
                            value={v.headline}
                            onChange={(e) => patchAdVariant(v.id, { headline: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <Field label="Call to action">
                <input className={inputCls} value={adCta} onChange={(e) => setAdCta(e.target.value)} />
              </Field>
            </>
          )}

          {kind === 'meta_lead_form' && (
            <>
              <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
              <Field label="Intro headline">
                <input className={inputCls} value={lfHeadline} onChange={(e) => setLfHeadline(e.target.value)} />
              </Field>
              <Field label="Intro description">
                <textarea className={`${inputCls} min-h-[80px]`} value={lfDescription} onChange={(e) => setLfDescription(e.target.value)} />
              </Field>
              <Field label="CTA button">
                <input className={inputCls} value={lfCta} onChange={(e) => setLfCta(e.target.value)} />
              </Field>
              <p className="text-[11px] text-gray-500 -mt-1">
                To edit questions or other pages, edit the item directly.
              </p>
            </>
          )}

          {kind === 'google_search_ad' && (
            <>
              <p className="text-[11px] text-gray-500 -mt-1">
                Versions iterate on headlines and descriptions. Sitelinks, paths, and call extension stay from the base item.
              </p>
              <AssetListField
                label="Headlines"
                items={gadHeadlines}
                max={MAX_GAD_HEADLINES}
                charLimit={GAD_HEADLINE_CHARS}
                onUpdate={updateHeadline}
                onAdd={addHeadline}
                onRemove={removeHeadline}
                addLabel="Add headline"
              />
              <AssetListField
                label="Descriptions"
                items={gadDescriptions}
                max={MAX_GAD_DESCRIPTIONS}
                charLimit={GAD_DESCRIPTION_CHARS}
                onUpdate={updateDescription}
                onAdd={addDescription}
                onRemove={removeDescription}
                addLabel="Add description"
                multiline
              />
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
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. tightened copy, swapped hero shot"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-full disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal text-white text-[13px] font-semibold rounded-full hover:bg-teal-hover disabled:opacity-60 transition-colors shadow-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tiny presentational bits ─────────────────────────────────────── */

const inputCls = 'w-full px-3 py-2 bg-gray-50 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function AssetListField({
  label, items, max, charLimit, onUpdate, onAdd, onRemove, addLabel, multiline,
}: {
  label: string;
  items: string[];
  max: number;
  charLimit: number;
  onUpdate: (idx: number, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  addLabel: string;
  multiline?: boolean;
}) {
  const filled = items.filter((v) => v.trim()).length;
  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-gray-400">{filled}/{max}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((value, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 text-[10px] tabular-nums text-gray-400 w-4 text-right">{i + 1}.</span>
            {multiline ? (
              <textarea
                className={`${inputCls} min-h-[52px]`}
                value={value}
                onChange={(e) => onUpdate(i, e.target.value)}
                maxLength={charLimit}
              />
            ) : (
              <input
                className={inputCls}
                value={value}
                onChange={(e) => onUpdate(i, e.target.value)}
                maxLength={charLimit}
              />
            )}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="mt-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      {items.length < max && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-teal hover:text-teal-hover font-medium"
        >
          <Plus size={13} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function FileInput({
  file, onChange, accept, optional,
}: { file: File | null; onChange: (f: File | null) => void; accept: string; optional?: boolean }) {
  return (
    <Field label={optional ? 'New file (optional)' : 'New file'}>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-200 file:text-[12px] file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
        />
        {file && <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{file.name}</span>}
      </div>
    </Field>
  );
}
