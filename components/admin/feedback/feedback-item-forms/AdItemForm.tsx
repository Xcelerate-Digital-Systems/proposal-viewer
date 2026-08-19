'use client';

import { useState, useRef } from 'react';
import { X, Upload, ChevronLeft, Plus, GripVertical, Link, Trash2, ImageIcon, Film, LayoutGrid } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant, type AdCreative, type AdCreativeFormat, type CarouselCard } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import { type AdItemFormProps } from './ad-form/ad-form-types';
import { useAdFormVariations } from './ad-form/useAdFormVariations';
import { AdVariationPanel } from './ad-form/AdVariationPanel';
import { AdCtaDropdown } from './ad-form/AdCtaDropdown';

/* ------------------------------------------------------------------ */
/*  Top-level ad format: Single Image / Carousel / Video               */
/* ------------------------------------------------------------------ */
type AdFormatMode = 'image' | 'carousel' | 'video';

const FORMAT_MODE_META: { key: AdFormatMode; label: string; icon: typeof ImageIcon }[] = [
  { key: 'image', label: 'Single Image', icon: ImageIcon },
  { key: 'carousel', label: 'Carousel', icon: LayoutGrid },
  { key: 'video', label: 'Video', icon: Film },
];

/* Sub-format for image & video: square / vertical */
type AspectRatio = 'square' | 'vertical';
const ASPECT_LABELS: Record<AspectRatio, string> = { square: 'Square (1:1)', vertical: 'Vertical (9:16)' };
const ASPECT_CSS: Record<AspectRatio, string> = { square: 'aspect-square', vertical: 'aspect-[9/16]' };
const ASPECTS: AspectRatio[] = ['square', 'vertical'];

type CarouselCardDraft = {
  id: string;
  file: File | null;
  preview: string | null;
  headline: string;
  description: string;
  destination_url: string;
};

function newCarouselCard(): CarouselCardDraft {
  return {
    id: crypto.randomUUID().slice(0, 8),
    file: null,
    preview: null,
    headline: '',
    description: '',
    destination_url: '',
  };
}

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange, reviewProjectId, companyId, uploadAsset }: AdItemFormProps) {
  const toast = useToast();

  /* ---- state: top-level format ---- */
  const [formatMode, setFormatMode] = useState<AdFormatMode>('image');

  /* ---- state: image uploads (square / vertical) ---- */
  const squareInputRef = useRef<HTMLInputElement>(null);
  const verticalInputRef = useRef<HTMLInputElement>(null);
  const [activeAspect, setActiveAspect] = useState<AspectRatio>('square');
  const [squareFile, setSquareFile] = useState<File | null>(null);
  const [squarePreview, setSquarePreview] = useState<string | null>(null);
  const [verticalFile, setVerticalFile] = useState<File | null>(null);
  const [verticalPreview, setVerticalPreview] = useState<string | null>(null);

  /* ---- state: video uploads (square / vertical) ---- */
  const videoSquareInputRef = useRef<HTMLInputElement>(null);
  const videoVerticalInputRef = useRef<HTMLInputElement>(null);
  const [videoAspect, setVideoAspect] = useState<AspectRatio>('square');
  const [videoSquareFile, setVideoSquareFile] = useState<File | null>(null);
  const [videoSquarePreview, setVideoSquarePreview] = useState<string | null>(null);
  const [videoVerticalFile, setVideoVerticalFile] = useState<File | null>(null);
  const [videoVerticalPreview, setVideoVerticalPreview] = useState<string | null>(null);
  // Thumbnail image for the video (used as ad_creative_url / list card)
  const videoThumbInputRef = useRef<HTMLInputElement>(null);
  const [videoThumbFile, setVideoThumbFile] = useState<File | null>(null);
  const [videoThumbPreview, setVideoThumbPreview] = useState<string | null>(null);

  /* ---- state: carousel ---- */
  const carouselInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [carouselCards, setCarouselCards] = useState<CarouselCardDraft[]>([newCarouselCard(), newCarouselCard()]);

  /* ---- state: shared ---- */
  const [title, setTitle] = useState('');
  const [adCta, setAdCta] = useState('Learn More');
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('facebook_feed');

  const {
    variations, setVariations,
    activeVariationId, setActiveVariationId,
    loadingExisting,
    selectedVariations, activeVariation,
    originalExistingRef,
    toggleVariation, patchVariation, addNewVariation, removeVariation,
  } = useAdFormVariations(reviewProjectId, companyId);

  /* ================================================================== */
  /*  File handlers                                                      */
  /* ================================================================== */

  const handleImageFileChange = (aspect: AspectRatio) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (aspect === 'square') { setSquareFile(selected); setSquarePreview(dataUrl); }
      else { setVerticalFile(selected); setVerticalPreview(dataUrl); }
    };
    reader.readAsDataURL(selected);
  };

  const handleVideoFileChange = (aspect: AspectRatio) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('video/')) { toast.error('Please select a video file'); return; }
    if (selected.size > 256 * 1024 * 1024) { toast.error('Video must be under 256MB'); return; }
    const url = URL.createObjectURL(selected);
    if (aspect === 'square') { setVideoSquareFile(selected); setVideoSquarePreview(url); }
    else { setVideoVerticalFile(selected); setVideoVerticalPreview(url); }
  };

  const handleVideoThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setVideoThumbFile(selected);
      setVideoThumbPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleCarouselFileChange = (cardId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCarouselCards((prev) => prev.map((c) => c.id === cardId ? { ...c, file: selected, preview: dataUrl } : c));
    };
    reader.readAsDataURL(selected);
  };

  const clearImageFile = (aspect: AspectRatio) => {
    if (aspect === 'square') {
      setSquareFile(null); setSquarePreview(null);
      if (squareInputRef.current) squareInputRef.current.value = '';
    } else {
      setVerticalFile(null); setVerticalPreview(null);
      if (verticalInputRef.current) verticalInputRef.current.value = '';
    }
  };

  const clearVideoFile = (aspect: AspectRatio) => {
    if (aspect === 'square') {
      setVideoSquareFile(null); setVideoSquarePreview(null);
      if (videoSquareInputRef.current) videoSquareInputRef.current.value = '';
    } else {
      setVideoVerticalFile(null); setVideoVerticalPreview(null);
      if (videoVerticalInputRef.current) videoVerticalInputRef.current.value = '';
    }
  };

  const updateCarouselCard = (cardId: string, patch: Partial<CarouselCardDraft>) => {
    setCarouselCards((prev) => prev.map((c) => c.id === cardId ? { ...c, ...patch } : c));
  };

  const removeCarouselCard = (cardId: string) => {
    setCarouselCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const addCarouselCard = () => {
    if (carouselCards.length >= 10) { toast.error('Maximum 10 carousel cards'); return; }
    setCarouselCards((prev) => [...prev, newCarouselCard()]);
  };

  /* ================================================================== */
  /*  Validation                                                         */
  /* ================================================================== */

  const isCarouselValid = carouselCards.length >= 2 && carouselCards.every((c) => c.file !== null);
  const hasValidCreative = formatMode === 'image' ? !!squareFile
    : formatMode === 'carousel' ? isCarouselValid
    : !!(videoSquareFile && videoThumbFile);

  /* ================================================================== */
  /*  Submit                                                             */
  /* ================================================================== */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidCreative || !title.trim()) return;

    const selected = variations.filter((v) => v.selected);
    if (selected.length === 0) {
      toast.error('Select or create at least one copy variation');
      return;
    }

    const existingIds = selected.filter((v) => v.isExisting).map((v) => v.id);
    const newVariants = selected
      .filter((v) => !v.isExisting)
      .map((v) => ({ label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim() }))
      .filter((v) => v.headline || v.primary_text);

    for (const v of selected.filter((v) => v.isExisting)) {
      const orig = originalExistingRef.current.get(v.id);
      if (!orig) continue;
      if (orig.label !== v.label || orig.headline !== v.headline || orig.primary_text !== v.primary_text) {
        const qs = companyId ? `?company_id=${companyId}` : '';
        authFetch(`/api/campaigns/${reviewProjectId}/ad-variations${qs}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variation_id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim() }),
        }).catch(() => {});
      }
    }

    const previewVariants: MetaAdVariant[] = selected.map((v) => ({
      id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim(),
    }));
    const first = previewVariants[0] ?? { headline: '', primary_text: '' };

    const basePayload = {
      title: title.trim(),
      type: 'ad' as const,
      ad_headline: first.headline || null,
      ad_copy: first.primary_text || null,
      ad_cta: adCta.trim() || 'Learn More',
      ad_platform: adPlatform,
      meta_ad_variants: previewVariants.length > 0 ? previewVariants : null,
      _ad_variation_data: { existing_variation_ids: existingIds, new_variations: newVariants },
    };

    if (formatMode === 'carousel') {
      const uploadedCards: CarouselCard[] = [];
      for (const card of carouselCards) {
        if (!card.file || !uploadAsset) continue;
        const url = await uploadAsset(card.file);
        if (!url) { toast.error('Failed to upload carousel image'); return; }
        uploadedCards.push({
          id: card.id,
          image_url: url,
          headline: card.headline.trim(),
          description: card.description.trim(),
          destination_url: card.destination_url.trim(),
          filename: card.file.name,
        });
      }
      await onSubmit({ ...basePayload, _carousel_cards: uploadedCards }, carouselCards[0].file!);
    } else if (formatMode === 'video') {
      // Upload video files + thumbnail
      const videoCreatives: { format: AdCreativeFormat; url: string; filename?: string }[] = [];

      if (videoSquareFile && uploadAsset) {
        const url = await uploadAsset(videoSquareFile);
        if (url) videoCreatives.push({ format: 'video_square', url, filename: videoSquareFile.name });
      }
      if (videoVerticalFile && uploadAsset) {
        const url = await uploadAsset(videoVerticalFile);
        if (url) videoCreatives.push({ format: 'video_vertical', url, filename: videoVerticalFile.name });
      }

      await onSubmit(
        { ...basePayload, _ad_extra_creatives: videoCreatives.length > 0 ? videoCreatives : undefined },
        videoThumbFile!,
      );
    } else {
      // Single image
      let verticalCreatives: { format: AdCreativeFormat; url: string; filename?: string }[] = [];
      if (verticalFile && uploadAsset) {
        const verticalUrl = await uploadAsset(verticalFile);
        if (verticalUrl) {
          verticalCreatives = [{ format: 'vertical', url: verticalUrl, filename: verticalFile.name }];
        }
      }
      await onSubmit(
        { ...basePayload, _ad_extra_creatives: verticalCreatives.length > 0 ? verticalCreatives : undefined },
        squareFile!,
      );
    }
  };

  /* ================================================================== */
  /*  Preview data                                                       */
  /* ================================================================== */

  const mockupVariants: MetaAdVariant[] = selectedVariations.map((v) => ({
    id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim(),
  }));

  const previewCreatives: AdCreative[] = [];
  if (squarePreview) previewCreatives.push({ id: 'sq', url: squarePreview, format: 'square' });
  if (verticalPreview) previewCreatives.push({ id: 'vt', url: verticalPreview, format: 'vertical' });
  if (isCarouselValid) previewCreatives.push({ id: 'car', url: carouselCards[0].preview!, format: 'carousel' });

  const carouselPreviewCards: CarouselCard[] = carouselCards
    .filter((c) => c.preview)
    .map((c) => ({
      id: c.id,
      image_url: c.preview!,
      headline: c.headline,
      description: c.description,
      destination_url: c.destination_url,
    }));

  const currentMockupPreview = formatMode === 'carousel'
    ? carouselCards[0]?.preview
    : formatMode === 'video'
      ? videoThumbPreview
      : (activeAspect === 'square' ? squarePreview : verticalPreview);

  const activeCreativeFormat: AdCreativeFormat | undefined = formatMode === 'carousel' ? 'carousel' : undefined;

  const formatCountLabel = [
    squareFile ? '1:1' : null,
    verticalFile ? '9:16' : null,
    isCarouselValid ? 'carousel' : null,
    videoSquareFile ? 'video 1:1' : null,
    videoVerticalFile ? 'video 9:16' : null,
  ].filter(Boolean);

  /* ================================================================== */
  /*  Render helpers                                                     */
  /* ================================================================== */

  const renderAspectTabs = (active: AspectRatio, onSelect: (a: AspectRatio) => void, hasSquare: boolean, hasVertical: boolean) => (
    <div className="flex rounded-lg overflow-hidden border border-edge-strong mb-3">
      {ASPECTS.map((a) => {
        const isActive = active === a;
        const hasFile = a === 'square' ? hasSquare : hasVertical;
        return (
          <button
            key={a}
            type="button"
            onClick={() => onSelect(a)}
            className="flex-1 px-3 py-1.5 text-xs font-medium transition-colors relative"
            style={{
              backgroundColor: isActive ? '#017C87' : 'transparent',
              color: isActive ? '#fff' : '#6b7280',
            }}
          >
            {ASPECT_LABELS[a]}
            {hasFile && !isActive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        );
      })}
    </div>
  );

  const renderUploadArea = (
    preview: string | null,
    file: File | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    aspect: AspectRatio,
    onClear: () => void,
    accept: string,
    label: string,
    hint: string,
    optionalNote?: string,
    isVideo?: boolean,
  ) => {
    if (preview) {
      return (
        <div className="rounded-2xl border border-edge-strong bg-white overflow-hidden">
          {isVideo ? (
            <video src={preview} className={`w-full ${ASPECT_CSS[aspect]} object-cover`} controls muted />
          ) : (
            <img src={preview} alt="Preview" loading="lazy" className={`w-full ${ASPECT_CSS[aspect]} object-cover`} />
          )}
          <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-edge">
            <p className="text-detail text-faint truncate">{file?.name || 'File loaded'}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-detail font-semibold text-teal hover:text-teal-hover">Replace</button>
              <button type="button" onClick={onClear} className="p-1 rounded-full text-faint hover:text-red-500 transition-colors" title="Remove"><X size={12} /></button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full ${ASPECT_CSS[aspect]} border-2 border-dashed border-edge-strong rounded-2xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors`}
      >
        <Upload size={24} className="text-faint mb-2" />
        <p className="text-xs font-medium text-prose">{label}</p>
        <p className="text-2xs text-faint mt-1">{hint}</p>
        {optionalNote && <p className="text-2xs text-faint mt-0.5">{optionalNote}</p>}
      </button>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* LEFT COLUMN */}
        <div className="w-[420px] shrink-0 border-r border-edge-strong flex flex-col overflow-y-auto">
          <div className="p-5 space-y-4 flex-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">
                Ad Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Summer Sale — Awareness"
                className="w-full px-3 py-2 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
                autoFocus
              />
            </div>

            {/* ============ Format Mode Selector ============ */}
            <div>
              <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">
                Format <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2 mb-4">
                {FORMAT_MODE_META.map(({ key, label, icon: Icon }) => {
                  const isActive = formatMode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormatMode(key)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: isActive ? '#017C87' : '#e5e7eb',
                        backgroundColor: isActive ? '#017C870A' : 'transparent',
                      }}
                    >
                      <Icon size={20} style={{ color: isActive ? '#017C87' : '#9ca3af' }} />
                      <span className="text-xs font-medium" style={{ color: isActive ? '#017C87' : '#6b7280' }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ============ Creative Area ============ */}
            <div>
              <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">
                Creative <span className="text-red-400">*</span>
              </label>

              {/* ---- SINGLE IMAGE ---- */}
              {formatMode === 'image' && (
                <>
                  {renderAspectTabs(activeAspect, setActiveAspect, !!squareFile, !!verticalFile)}
                  <input ref={squareInputRef} type="file" accept="image/*" onChange={handleImageFileChange('square')} className="hidden" />
                  <input ref={verticalInputRef} type="file" accept="image/*" onChange={handleImageFileChange('vertical')} className="hidden" />
                  {renderUploadArea(
                    activeAspect === 'square' ? squarePreview : verticalPreview,
                    activeAspect === 'square' ? squareFile : verticalFile,
                    activeAspect === 'square' ? squareInputRef : verticalInputRef,
                    activeAspect,
                    () => clearImageFile(activeAspect),
                    'image/*',
                    `Upload ${activeAspect === 'square' ? '1:1' : '9:16'} creative`,
                    `${activeAspect === 'square' ? '1:1 recommended' : '9:16 for Stories & Reels'} · max 10MB`,
                    activeAspect === 'vertical' ? 'Optional — square is required' : undefined,
                  )}
                </>
              )}

              {/* ---- VIDEO ---- */}
              {formatMode === 'video' && (
                <>
                  {renderAspectTabs(videoAspect, setVideoAspect, !!videoSquareFile, !!videoVerticalFile)}
                  <input ref={videoSquareInputRef} type="file" accept="video/*" onChange={handleVideoFileChange('square')} className="hidden" />
                  <input ref={videoVerticalInputRef} type="file" accept="video/*" onChange={handleVideoFileChange('vertical')} className="hidden" />
                  {renderUploadArea(
                    videoAspect === 'square' ? videoSquarePreview : videoVerticalPreview,
                    videoAspect === 'square' ? videoSquareFile : videoVerticalFile,
                    videoAspect === 'square' ? videoSquareInputRef : videoVerticalInputRef,
                    videoAspect,
                    () => clearVideoFile(videoAspect),
                    'video/*',
                    `Upload ${videoAspect === 'square' ? '1:1' : '9:16'} video`,
                    `${videoAspect === 'square' ? '1:1 recommended' : '9:16 for Stories & Reels'} · max 256MB`,
                    videoAspect === 'vertical' ? 'Optional — square is required' : undefined,
                    true,
                  )}
                  {/* Thumbnail */}
                  <div className="mt-3">
                    <p className="text-2xs font-medium text-dim uppercase tracking-wider mb-1.5">
                      Thumbnail Image <span className="text-red-400">*</span>
                    </p>
                    <input ref={videoThumbInputRef} type="file" accept="image/*" onChange={handleVideoThumbChange} className="hidden" />
                    {videoThumbPreview ? (
                      <div className="rounded-2xl border border-edge-strong bg-white overflow-hidden">
                        <img src={videoThumbPreview} alt="Thumbnail" loading="lazy" className="w-full aspect-video object-cover" />
                        <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-edge">
                          <p className="text-detail text-faint truncate">{videoThumbFile?.name}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => videoThumbInputRef.current?.click()} className="text-detail font-semibold text-teal hover:text-teal-hover">Replace</button>
                            <button type="button" onClick={() => { setVideoThumbFile(null); setVideoThumbPreview(null); if (videoThumbInputRef.current) videoThumbInputRef.current.value = ''; }} className="p-1 rounded-full text-faint hover:text-red-500 transition-colors"><X size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => videoThumbInputRef.current?.click()}
                        className="w-full aspect-video border-2 border-dashed border-edge-strong rounded-2xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors"
                      >
                        <Upload size={20} className="text-faint mb-1.5" />
                        <p className="text-xs font-medium text-prose">Upload thumbnail</p>
                        <p className="text-2xs text-faint mt-1">Used as preview in feeds · max 10MB</p>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ---- CAROUSEL ---- */}
              {formatMode === 'carousel' && (
                <div className="space-y-3">
                  <p className="text-2xs text-faint">
                    Add 2–10 cards. Each card gets its own image, headline, description, and link.
                  </p>
                  {carouselCards.map((card, idx) => (
                    <div key={card.id} className="rounded-2xl border border-edge-strong bg-surface overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
                        <GripVertical size={12} className="text-faint" />
                        <span className="text-xs font-semibold text-dim">Card {idx + 1}</span>
                        <div className="flex-1" />
                        {carouselCards.length > 2 && (
                          <button type="button" onClick={() => removeCarouselCard(card.id)} className="p-1 rounded text-faint hover:text-red-500 transition-colors" title="Remove card">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { if (el) carouselInputRefs.current.set(card.id, el); }}
                          onChange={handleCarouselFileChange(card.id)}
                        />
                        {card.preview ? (
                          <div className="rounded-xl border border-edge overflow-hidden">
                            <img src={card.preview} alt={`Card ${idx + 1}`} loading="lazy" className="w-full aspect-square object-cover" />
                            <div className="flex items-center justify-between px-2 py-1.5 bg-white border-t border-edge">
                              <p className="text-2xs text-faint truncate">{card.file?.name}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => carouselInputRefs.current.get(card.id)?.click()} className="text-2xs font-semibold text-teal hover:text-teal-hover">Replace</button>
                                <button type="button" onClick={() => updateCarouselCard(card.id, { file: null, preview: null })} className="p-0.5 text-faint hover:text-red-500"><X size={10} /></button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => carouselInputRefs.current.get(card.id)?.click()}
                            className="w-full aspect-square border-2 border-dashed border-edge-strong rounded-xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors"
                          >
                            <Upload size={18} className="text-faint mb-1" />
                            <p className="text-2xs font-medium text-prose">Upload image</p>
                          </button>
                        )}
                        <input
                          type="text"
                          value={card.headline}
                          onChange={(e) => updateCarouselCard(card.id, { headline: e.target.value })}
                          placeholder="Headline"
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-teal/20 border border-edge"
                        />
                        <input
                          type="text"
                          value={card.description}
                          onChange={(e) => updateCarouselCard(card.id, { description: e.target.value })}
                          placeholder="Description"
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-teal/20 border border-edge"
                        />
                        <div className="relative">
                          <Link size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                          <input
                            type="text"
                            value={card.destination_url}
                            onChange={(e) => updateCarouselCard(card.id, { destination_url: e.target.value })}
                            placeholder="https://example.com"
                            className="w-full pl-7 pr-2.5 py-1.5 bg-white rounded-lg text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-teal/20 border border-edge"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {carouselCards.length < 10 && (
                    <button
                      type="button"
                      onClick={addCarouselCard}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-edge-strong rounded-2xl text-xs font-medium text-dim hover:border-teal hover:text-teal transition-colors"
                    >
                      <Plus size={14} />
                      Add Card
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* CTA */}
            <AdCtaDropdown value={adCta} onChange={setAdCta} />

            {/* Live preview */}
            {hasValidCreative && mockupVariants.length > 0 && (
              <div className="pt-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-dim mb-2">Preview</p>
                <div className="transform scale-[0.65] origin-top-left" style={{ width: '154%' }}>
                  <AdMockupPreview
                    creativeUrl={currentMockupPreview || squarePreview || ''}
                    ctaText={adCta}
                    platform={adPlatform}
                    pageName="Your Brand"
                    showPlatformToggle
                    onPlatformChange={setAdPlatform}
                    variants={mockupVariants}
                    activeVariantId={activeVariation?.id}
                    onVariantChange={(id) => setActiveVariationId(id)}
                    formatCreatives={previewCreatives.length >= 2 ? previewCreatives : undefined}
                    activeFormat={activeCreativeFormat}
                    carouselCards={formatMode === 'carousel' && carouselPreviewCards.length >= 2 ? carouselPreviewCards : undefined}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Copy Variations */}
        <AdVariationPanel
          variations={variations}
          setVariations={setVariations}
          activeVariationId={activeVariation?.id ?? null}
          setActiveVariationId={setActiveVariationId}
          toggleVariation={toggleVariation}
          patchVariation={patchVariation}
          addNewVariation={addNewVariation}
          removeVariation={removeVariation}
          loadingExisting={loadingExisting}
        />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-edge-strong px-5 py-3 flex items-center justify-between bg-white">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-dim hover:text-prose transition-colors"
        >
          <ChevronLeft size={14} /> Change type
        </button>
        <div className="flex items-center gap-2">
          <span className="text-detail text-faint mr-1">
            {selectedVariations.length} variation{selectedVariations.length !== 1 ? 's' : ''} selected
            {formatCountLabel.length > 0 ? ` · ${formatCountLabel.join(', ')}` : ''}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={uploading} disabled={!hasValidCreative || !title.trim() || uploading || selectedVariations.length === 0}>
            Add Meta Ad
          </Button>
        </div>
      </div>
    </form>
  );
}
