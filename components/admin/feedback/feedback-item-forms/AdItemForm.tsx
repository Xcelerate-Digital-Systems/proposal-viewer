'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Type, AlignLeft, Copy, ChevronDown, Megaphone } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import FormActions from './FormActions';
import { type MetaAdVariant, getMetaAdVariants } from '@/lib/types/feedback';
import { supabase } from '@/lib/supabase';

const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

interface AdItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  /** Notify parent when preview panel visibility changes (for modal width) */
  onPreviewChange?: (visible: boolean) => void;
  /** Project id — used to surface variants from other Meta ads in this
   *  project so the user can import them in one click. */
  reviewProjectId?: string;
}

/** Shape returned by the "import variants from another ad" picker query. */
type ImportableAd = {
  id: string;
  title: string;
  variants: MetaAdVariant[];
};

function newVariantId(): string {
  // 8-char stable id — see metaAdVariantView() for how this feeds the
  // pin-scoping view string `variant-<id>`.
  return crypto.randomUUID().slice(0, 8);
}

function newVariant(): MetaAdVariant {
  return { id: newVariantId(), label: '', primary_text: '', headline: '' };
}

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange, reviewProjectId }: AdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [variants, setVariants] = useState<MetaAdVariant[]>(() => [newVariant()]);
  const [activeVariantId, setActiveVariantId] = useState<string>(() => variants[0].id);
  const [adCta, setAdCta] = useState('Learn More');
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('facebook_feed');
  const [showPreview, setShowPreview] = useState(false);

  // Other Meta ads in this project that already have variants. Used to fill
  // the "Import variants from another ad" picker so users can clone copy
  // across ads without retyping. Legacy ads with just ad_headline/ad_copy
  // are folded in as a single synthesised variant via getMetaAdVariants().
  const [importableAds, setImportableAds] = useState<ImportableAd[]>([]);
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const importPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reviewProjectId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('review_items')
        .select('id, title, ad_headline, ad_copy, meta_ad_variants')
        .eq('review_project_id', reviewProjectId)
        .eq('type', 'ad')
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
  }, [reviewProjectId]);

  // Close picker when clicking outside
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
    // Clone each variant with a fresh id so pins on the source ad don't
    // alias to this new ad's variants. Append to whatever the user already
    // has (so they can stack from multiple sources if they want).
    const cloned = ad.variants.map<MetaAdVariant>((v) => ({
      id: newVariantId(),
      label: v.label ?? '',
      headline: v.headline,
      primary_text: v.primary_text,
    }));
    setVariants((prev) => {
      // If the only existing variant is empty (i.e. the default starter
      // variant we created on mount), replace it with the imported set so
      // the user doesn't have to clean up an empty row.
      const hasOnlyEmptyStarter = prev.length === 1 && !prev[0].headline.trim() && !prev[0].primary_text.trim();
      const next = hasOnlyEmptyStarter ? cloned : [...prev, ...cloned];
      setActiveVariantId(next[0].id);
      return next;
    });
    setImportPickerOpen(false);
    toast.success(`Imported ${cloned.length} variant${cloned.length === 1 ? '' : 's'} from “${ad.title}”`);
  };

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setFile(selected);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const patchVariant = (id: string, patch: Partial<MetaAdVariant>) =>
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addVariant = () => {
    const v = newVariant();
    setVariants((prev) => [...prev, v]);
    setActiveVariantId(v.id);
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((v) => v.id !== id);
      if (activeVariantId === id) setActiveVariantId(next[0].id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    const cleanVariants = variants
      .map((v) => ({
        ...v,
        label: (v.label ?? '').trim() || null,
        primary_text: v.primary_text.trim(),
        headline: v.headline.trim(),
      }))
      .filter((v) => v.primary_text || v.headline);
    const first = cleanVariants[0] ?? { primary_text: '', headline: '' };
    await onSubmit(
      {
        title: title.trim(),
        type: 'ad',
        // Keep ad_headline / ad_copy in sync with the first variant so any
        // legacy consumer that hasn't been updated keeps working.
        ad_headline: first.headline || null,
        ad_copy: first.primary_text || null,
        ad_cta: adCta.trim() || 'Learn More',
        ad_platform: adPlatform,
        meta_ad_variants: cleanVariants.length > 0 ? cleanVariants : null,
      },
      file,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-5 overflow-y-auto`}>
        {/* Title + CTA on a single row — both short, no point stacking. */}
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Item Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Sale"
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              CTA
            </label>
            <select
              value={adCta}
              onChange={(e) => setAdCta(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20"
            >
              {CTA_OPTIONS.map((cta) => (
                <option key={cta} value={cta}>{cta}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Creative Image — slim preview row when a file is set, large upload tile otherwise. */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Creative Image <span className="text-red-400">*</span>
          </label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {preview ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2">
              <img
                src={preview}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 bg-white shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-gray-700 truncate">{file?.name || 'Creative loaded'}</p>
                <p className="text-[11px] text-gray-400">1:1 ratio recommended</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-teal hover:text-teal-hover px-2 py-1 rounded"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clearFile}
                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                title="Remove"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={18} className="mx-auto mb-1 text-gray-400" />
              <p className="text-xs font-medium text-gray-600">Upload ad creative</p>
              <p className="text-[10px] text-gray-400 mt-0.5">1:1 ratio recommended · max 10MB</p>
            </button>
          )}
        </div>

        {/* Variants */}
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
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
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
                onClick={addVariant}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-hover"
              >
                <Plus size={12} />
                Add variant
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">
            Each variant is a (primary text, headline) pair. Reviewers switch between them in the sidebar — pin comments stay scoped to the active variant.
          </p>
          <ol className="space-y-2.5">
            {variants.map((v, i) => {
              const active = v.id === activeVariantId;
              return (
                <li
                  key={v.id}
                  className={`rounded-xl border transition-colors ${
                    active ? 'border-teal/40 bg-teal/5' : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Header: number badge + label input + delete */}
                  <div className="flex items-center gap-2 px-3 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveVariantId(v.id)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-semibold shrink-0 transition-colors ${
                        active ? 'bg-teal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={`Make variant ${i + 1} the active one`}
                    >
                      {i + 1}
                    </button>
                    <input
                      type="text"
                      value={v.label ?? ''}
                      onChange={(e) => patchVariant(v.id, { label: e.target.value })}
                      onFocus={() => setActiveVariantId(v.id)}
                      placeholder={`Variant ${i + 1} name (optional)`}
                      className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-ink placeholder:text-gray-400 placeholder:font-normal outline-none"
                    />
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(v.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded shrink-0"
                        title="Remove variant"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="px-3 pb-3 pt-2 space-y-2">
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        <AlignLeft size={10} /> Primary text
                      </label>
                      <textarea
                        value={v.primary_text}
                        onChange={(e) => patchVariant(v.id, { primary_text: e.target.value })}
                        onFocus={() => setActiveVariantId(v.id)}
                        rows={2}
                        placeholder="Body copy shown above the image…"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 resize-y min-h-[52px]"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        <Type size={10} /> Headline
                      </label>
                      <input
                        type="text"
                        value={v.headline}
                        onChange={(e) => patchVariant(v.id, { headline: e.target.value })}
                        onFocus={() => setActiveVariantId(v.id)}
                        placeholder="Short punchy headline…"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!file || !title.trim() || uploading}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: !!preview, onToggle: togglePreview }}
        />
      </div>

      {showPreview && preview && (
        <div className="w-1/2 p-6 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <AdMockupPreview
            creativeUrl={preview}
            ctaText={adCta}
            platform={adPlatform}
            pageName="Your Brand"
            showPlatformToggle
            onPlatformChange={setAdPlatform}
            variants={variants}
            activeVariantId={activeVariantId}
            onVariantChange={setActiveVariantId}
          />
        </div>
      )}
    </form>
  );
}
