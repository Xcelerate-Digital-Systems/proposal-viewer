'use client';

import { useState, useRef } from 'react';
import { X, Upload, ChevronLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import { type AdItemFormProps } from './ad-form/ad-form-types';
import { useAdFormVariations } from './ad-form/useAdFormVariations';
import { AdVariationPanel } from './ad-form/AdVariationPanel';
import { AdCtaDropdown } from './ad-form/AdCtaDropdown';

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange, reviewProjectId, companyId }: AdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

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

    // Patch any existing variations whose copy was edited
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
      },
      file,
    );
  };

  const mockupVariants: MetaAdVariant[] = selectedVariations.map((v) => ({
    id: v.id, label: v.label.trim() || null, headline: v.headline.trim(), primary_text: v.primary_text.trim(),
  }));

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      {/* ── Two-column body ── */}
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

            {/* Creative Image */}
            <div>
              <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1.5">
                Creative <span className="text-red-400">*</span>
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {preview ? (
                <div className="rounded-2xl border border-edge-strong bg-white overflow-hidden">
                  <img src={preview} alt="Preview" loading="lazy" className="w-full aspect-square object-cover" />
                  <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-edge">
                    <p className="text-detail text-faint truncate">{file?.name || 'Creative loaded'}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-detail font-semibold text-teal hover:text-teal-hover">
                        Replace
                      </button>
                      <button type="button" onClick={clearFile} className="p-1 rounded-full text-faint hover:text-red-500 transition-colors" title="Remove">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-square border-2 border-dashed border-edge-strong rounded-2xl flex flex-col items-center justify-center hover:border-teal hover:bg-teal/5 transition-colors">
                  <Upload size={24} className="text-faint mb-2" />
                  <p className="text-xs font-medium text-prose">Upload ad creative</p>
                  <p className="text-2xs text-faint mt-1">1:1 recommended · max 10MB</p>
                </button>
              )}
            </div>

            {/* CTA */}
            <AdCtaDropdown value={adCta} onChange={setAdCta} />

            {/* Live preview (only when creative is uploaded and variations selected) */}
            {preview && mockupVariants.length > 0 && (
              <div className="pt-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-dim mb-2">Preview</p>
                <div className="transform scale-[0.65] origin-top-left" style={{ width: '154%' }}>
                  <AdMockupPreview
                    creativeUrl={preview}
                    ctaText={adCta}
                    platform={adPlatform}
                    pageName="Your Brand"
                    showPlatformToggle
                    onPlatformChange={setAdPlatform}
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

      {/* ── Footer ── */}
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
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={uploading} disabled={!file || !title.trim() || uploading || selectedVariations.length === 0}>
            Add Meta Ad
          </Button>
        </div>
      </div>
    </form>
  );
}
