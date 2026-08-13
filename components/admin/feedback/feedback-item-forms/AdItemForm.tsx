'use client';

import { useState, useRef } from 'react';
import { X, Upload, ChevronLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant, type AdCreative, type AdCreativeFormat } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import { type AdItemFormProps } from './ad-form/ad-form-types';
import { useAdFormVariations } from './ad-form/useAdFormVariations';
import { AdVariationPanel } from './ad-form/AdVariationPanel';
import { AdCtaDropdown } from './ad-form/AdCtaDropdown';

const FORMAT_LABELS: Record<AdCreativeFormat, string> = { square: 'Square (1:1)', vertical: 'Vertical (9:16)' };
const FORMAT_ASPECT: Record<AdCreativeFormat, string> = { square: 'aspect-square', vertical: 'aspect-[9/16]' };
const FORMATS: AdCreativeFormat[] = ['square', 'vertical'];

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange, reviewProjectId, companyId, uploadAsset }: AdItemFormProps) {
  const toast = useToast();
  const squareInputRef = useRef<HTMLInputElement>(null);
  const verticalInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [squareFile, setSquareFile] = useState<File | null>(null);
  const [squarePreview, setSquarePreview] = useState<string | null>(null);
  const [verticalFile, setVerticalFile] = useState<File | null>(null);
  const [verticalPreview, setVerticalPreview] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<AdCreativeFormat>('square');
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

  const handleFileChange = (format: AdCreativeFormat) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (format === 'square') { setSquareFile(selected); setSquarePreview(dataUrl); }
      else { setVerticalFile(selected); setVerticalPreview(dataUrl); }
    };
    reader.readAsDataURL(selected);
  };

  const clearFile = (format: AdCreativeFormat) => {
    if (format === 'square') {
      setSquareFile(null); setSquarePreview(null);
      if (squareInputRef.current) squareInputRef.current.value = '';
    } else {
      setVerticalFile(null); setVerticalPreview(null);
      if (verticalInputRef.current) verticalInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squareFile || !title.trim()) return;

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

    // Pre-upload vertical creative if provided
    let verticalCreatives: { format: AdCreativeFormat; url: string; filename?: string }[] = [];
    if (verticalFile && uploadAsset) {
      const verticalUrl = await uploadAsset(verticalFile);
      if (verticalUrl) {
        verticalCreatives = [{ format: 'vertical', url: verticalUrl, filename: verticalFile.name }];
      }
    }

    await onSubmit(
      {
        title: title.trim(),
        type: 'ad',
        ad_headline: first.headline || null,
        ad_copy: first.primary_text || null,
        ad_cta: adCta.trim() || 'Learn More',
        ad_platform: adPlatform,
        meta_ad_variants: previewVariants.length > 0 ? previewVariants : null,
        _ad_variation_data: { existing_variation_ids: existingIds, new_variations: newVariants },
        _ad_extra_creatives: verticalCreatives.length > 0 ? verticalCreatives : undefined,
      },
      squareFile,
    );
  };

  const mockupVariants: MetaAdVariant[] = selectedVariations.map((v) => ({
    id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim(),
  }));

  const currentPreview = activeFormat === 'square' ? squarePreview : verticalPreview;
  const currentFile = activeFormat === 'square' ? squareFile : verticalFile;
  const currentInputRef = activeFormat === 'square' ? squareInputRef : verticalInputRef;

  // Build preview creatives for the mockup
  const previewCreatives: AdCreative[] = [];
  if (squarePreview) previewCreatives.push({ id: 'sq', url: squarePreview, format: 'square' });
  if (verticalPreview) previewCreatives.push({ id: 'vt', url: verticalPreview, format: 'vertical' });

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      {/* Two-column body */}
      <div className="flex-1 min-h-0 flex">
        {/* LEFT: Creative + Title + CTA + Live preview */}
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

            {/* Format Tabs */}
            <div>
              <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">
                Creative <span className="text-red-400">*</span>
              </label>
              <div className="flex rounded-lg overflow-hidden border border-edge-strong mb-3">
                {FORMATS.map((fmt) => {
                  const isActive = activeFormat === fmt;
                  const hasFile = fmt === 'square' ? !!squareFile : !!verticalFile;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setActiveFormat(fmt)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium transition-colors relative"
                      style={{
                        backgroundColor: isActive ? '#017C87' : 'transparent',
                        color: isActive ? '#fff' : '#6b7280',
                      }}
                    >
                      {FORMAT_LABELS[fmt]}
                      {hasFile && !isActive && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* File inputs (hidden) */}
              <input ref={squareInputRef} type="file" accept="image/*" onChange={handleFileChange('square')} className="hidden" />
              <input ref={verticalInputRef} type="file" accept="image/*" onChange={handleFileChange('vertical')} className="hidden" />

              {/* Upload area for active format */}
              {currentPreview ? (
                <div className="rounded-2xl border border-edge-strong bg-white overflow-hidden">
                  <img
                    src={currentPreview}
                    alt="Preview"
                    loading="lazy"
                    className={`w-full ${FORMAT_ASPECT[activeFormat]} object-cover`}
                  />
                  <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-edge">
                    <p className="text-detail text-faint truncate">{currentFile?.name || 'Creative loaded'}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => currentInputRef.current?.click()} className="text-detail font-semibold text-teal hover:text-teal-hover">
                        Replace
                      </button>
                      <button type="button" onClick={() => clearFile(activeFormat)} className="p-1 rounded-full text-faint hover:text-red-500 transition-colors" title="Remove">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => currentInputRef.current?.click()}
                  className={`w-full ${FORMAT_ASPECT[activeFormat]} border-2 border-dashed border-edge-strong rounded-2xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors`}
                >
                  <Upload size={24} className="text-faint mb-2" />
                  <p className="text-xs font-medium text-prose">
                    Upload {activeFormat === 'square' ? '1:1' : '9:16'} creative
                  </p>
                  <p className="text-2xs text-faint mt-1">
                    {activeFormat === 'square' ? '1:1 recommended' : '9:16 for Stories & Reels'} · max 10MB
                  </p>
                  {activeFormat === 'vertical' && (
                    <p className="text-2xs text-faint mt-0.5">Optional — square is required</p>
                  )}
                </button>
              )}
            </div>

            {/* CTA */}
            <AdCtaDropdown value={adCta} onChange={setAdCta} />

            {/* Live preview */}
            {squarePreview && mockupVariants.length > 0 && (
              <div className="pt-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-dim mb-2">Preview</p>
                <div className="transform scale-[0.65] origin-top-left" style={{ width: '154%' }}>
                  <AdMockupPreview
                    creativeUrl={squarePreview}
                    ctaText={adCta}
                    platform={adPlatform}
                    pageName="Your Brand"
                    showPlatformToggle
                    onPlatformChange={setAdPlatform}
                    variants={mockupVariants}
                    activeVariantId={activeVariation?.id}
                    onVariantChange={(id) => setActiveVariationId(id)}
                    formatCreatives={previewCreatives.length >= 2 ? previewCreatives : undefined}
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
            {verticalFile ? ' · 2 formats' : ''}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={uploading} disabled={!squareFile || !title.trim() || uploading || selectedVariations.length === 0}>
            Add Meta Ad
          </Button>
        </div>
      </div>
    </form>
  );
}
