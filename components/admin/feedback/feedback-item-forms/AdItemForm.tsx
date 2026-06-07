'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Plus, Trash2, Type, AlignLeft, Check, ChevronDown, ChevronLeft, GripVertical } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import { Button } from '@/components/ui/Button';
import { type MetaAdVariant } from '@/lib/types/feedback';
import type { AdCopyVariation } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

const CTA_OPTIONS = [
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Download', 'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now',
  'Watch More', 'See Menu', 'Order Now', 'Get Directions',
];

type PickerVariation = {
  id: string;
  label: string;
  headline: string;
  primary_text: string;
  isExisting: boolean;
  selected: boolean;
  usedByCount?: number;
};

interface AdItemFormProps {
  onSubmit: (payload: Record<string, unknown>, file: File) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
  reviewProjectId?: string;
  companyId?: string;
}

function newTempId(): string {
  return `new-${crypto.randomUUID().slice(0, 8)}`;
}

function newInlineVariation(): PickerVariation {
  return { id: newTempId(), label: '', headline: '', primary_text: '', isExisting: false, selected: true };
}

export default function AdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange, reviewProjectId, companyId }: AdItemFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [variations, setVariations] = useState<PickerVariation[]>(() => [newInlineVariation()]);
  const [activeVariationId, setActiveVariationId] = useState<string>(() => variations[0].id);
  const [adCta, setAdCta] = useState('Learn More');
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('facebook_feed');
  const [loadingExisting, setLoadingExisting] = useState(false);
  // Snapshot of existing variations at load time — used to detect edits on submit
  const originalExistingRef = useRef<Map<string, { label: string; headline: string; primary_text: string }>>(new Map());

  // Fetch existing campaign variations via the API (handles super-admin auth)
  useEffect(() => {
    if (!reviewProjectId) return;
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      const qs = companyId ? `?company_id=${companyId}` : '';
      const res = await authFetch(`/api/campaigns/${reviewProjectId}/ad-variations${qs}`);
      if (cancelled || !res.ok) { setLoadingExisting(false); return; }
      const { variations: existingVariations, links } = await res.json() as {
        variations: AdCopyVariation[];
        links: { review_item_id: string; ad_copy_variation_id: string }[];
      };

      const usageCounts: Record<string, number> = {};
      for (const l of links) {
        usageCounts[l.ad_copy_variation_id] = (usageCounts[l.ad_copy_variation_id] ?? 0) + 1;
      }

      if (!cancelled && existingVariations.length > 0) {
        const existingPicker: PickerVariation[] = existingVariations
          .filter((v) => v.headline.trim() || v.primary_text.trim())
          .map((v) => ({
            id: v.id,
            label: v.label || '',
            headline: v.headline,
            primary_text: v.primary_text,
            isExisting: true,
            selected: false,
            usedByCount: usageCounts[v.id] || 0,
          }));

        // Snapshot for edit detection
        const snap = new Map<string, { label: string; headline: string; primary_text: string }>();
        for (const v of existingPicker) snap.set(v.id, { label: v.label, headline: v.headline, primary_text: v.primary_text });
        originalExistingRef.current = snap;

        setVariations((prev) => {
          const hasOnlyEmptyNew = prev.length === 1
            && !prev[0].isExisting
            && !prev[0].headline.trim()
            && !prev[0].primary_text.trim();
          if (hasOnlyEmptyNew && existingPicker.length > 0) {
            return [...existingPicker, ...prev];
          }
          return [...existingPicker, ...prev];
        });
      }
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [reviewProjectId]);

  const selectedVariations = variations.filter((v) => v.selected);
  const activeVariation = selectedVariations.find((v) => v.id === activeVariationId)
    ?? selectedVariations[0]
    ?? null;

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

  const toggleVariation = (id: string) => {
    setVariations((prev) => prev.map((v) =>
      v.id === id ? { ...v, selected: !v.selected } : v
    ));
  };

  const patchVariation = (id: string, patch: Partial<PickerVariation>) =>
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addNewVariation = () => {
    const v = newInlineVariation();
    setVariations((prev) => [...prev, v]);
    setActiveVariationId(v.id);
  };

  const removeVariation = (id: string) => {
    setVariations((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
      if (!v.isExisting) {
        const next = prev.filter((x) => x.id !== id);
        if (activeVariationId === id && next.length > 0) {
          const firstSelected = next.find((x) => x.selected);
          if (firstSelected) setActiveVariationId(firstSelected.id);
        }
        return next;
      }
      return prev.map((x) => x.id === id ? { ...x, selected: false } : x);
    });
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
                  <img src={preview} alt="Preview" className="w-full aspect-square object-cover" />
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
            <CtaDropdown value={adCta} onChange={setAdCta} />

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
        <VariationPanel
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

/* ─── Variation Panel with DnD ───────────────────────────────────── */

function VariationPanel({
  variations, setVariations, activeVariationId, setActiveVariationId,
  toggleVariation, patchVariation, addNewVariation, removeVariation, loadingExisting,
}: {
  variations: PickerVariation[];
  setVariations: React.Dispatch<React.SetStateAction<PickerVariation[]>>;
  activeVariationId: string | null;
  setActiveVariationId: (id: string) => void;
  toggleVariation: (id: string) => void;
  patchVariation: (id: string, patch: Partial<PickerVariation>) => void;
  addNewVariation: () => void;
  removeVariation: (id: string) => void;
  loadingExisting: boolean;
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
      setActiveVariationId('');
    } else {
      setActiveVariationId(id);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-dim uppercase tracking-wider">
            Copy Variations
          </label>
          <button
            type="button"
            onClick={addNewVariation}
            className="inline-flex items-center gap-1 text-detail font-semibold text-teal hover:text-teal-hover"
          >
            <Plus size={12} />
            New variation
          </button>
        </div>
        <p className="text-detail text-faint mb-4">
          Select existing variations or create new ones. Drag to reorder.
        </p>

        {loadingExisting && (
          <div className="flex items-center gap-2 text-detail text-faint py-2">
            <div className="w-3 h-3 border border-faint border-t-teal rounded-full animate-spin" />
            Loading campaign variations…
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={variations.map((v) => v.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {existingVars.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-dim">
                    Existing in this campaign
                  </p>
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
                    <p className="text-2xs font-semibold uppercase tracking-wider text-dim mt-3">
                      New variations
                    </p>
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
      </div>
    </div>
  );
}

/* ─── Sortable Existing Variation Row ────────────────────────────── */

function SortableExistingVariationRow(props: {
  variation: PickerVariation;
  isActive: boolean;
  onToggle: () => void;
  onActivate: () => void;
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

function ExistingVariationRow({
  variation, isActive, onToggle, onActivate, onPatch, dragHandleProps,
}: {
  variation: PickerVariation;
  isActive: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onPatch: (patch: Partial<PickerVariation>) => void;
  dragHandleProps?: Record<string, unknown>;
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
      onClick={() => {
        if (!variation.selected) onToggle();
        onActivate();
      }}
    >
      {/* Header row — always visible */}
      <div className="flex items-center gap-2.5 p-3">
        <button
          type="button"
          className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            variation.selected ? 'bg-teal border-teal text-white' : 'border-edge-hover hover:border-teal/50'
          }`}
        >
          {variation.selected && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          {expanded ? (
            <input
              type="text"
              value={variation.label}
              onChange={(e) => onPatch({ label: e.target.value })}
              placeholder="Variation name (optional)"
              className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs font-medium text-ink truncate">{displayLabel}</p>
          )}
          {!expanded && subtitle && <p className="text-detail text-faint line-clamp-2 mt-0.5">{subtitle}</p>}
        </div>
        {!expanded && (variation.usedByCount ?? 0) > 0 && (
          <span className="text-2xs text-dim shrink-0">
            {variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Expanded editor — shown when selected + active */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <AlignLeft size={10} /> Primary text
            </label>
            <textarea
              ref={textareaRef}
              value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <Type size={10} /> Headline
            </label>
            <input
              type="text"
              value={variation.headline}
              onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          {(variation.usedByCount ?? 0) > 0 && (
            <p className="text-2xs text-dim">
              Changes will update this copy across {variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sortable New Variation Editor ──────────────────────────────── */

function SortableNewVariationEditor(props: {
  variation: PickerVariation;
  index: number;
  isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void;
  onActivate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.variation.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <NewVariationEditor {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function NewVariationEditor({
  variation, index, isActive, onPatch, onActivate, onRemove, canRemove, dragHandleProps,
}: {
  variation: PickerVariation;
  index: number;
  isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void;
  onActivate: () => void;
  onRemove: () => void;
  canRemove: boolean;
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
      className={`rounded-2xl border transition-colors ${
        isActive ? 'border-teal/40 bg-teal/5' : 'border-edge-strong bg-white hover:bg-surface cursor-pointer'
      }`}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      {/* Header: drag handle + badge + label + delete */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onActivate(); }}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-detail font-semibold shrink-0 transition-colors ${
            isActive ? 'bg-teal text-white' : 'bg-surface text-prose hover:bg-edge'
          }`}
        >
          {index + 1}
        </button>
        {isActive ? (
          <input
            type="text"
            value={variation.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder={`Variation ${index + 1} name (optional)`}
            className="flex-1 min-w-0 bg-transparent text-caption font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="flex-1 min-w-0 text-xs font-medium text-ink truncate">{displayLabel}</p>
        )}
        {canRemove && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-faint hover:text-red-500 p-1 rounded shrink-0" title="Remove">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Collapsed subtitle */}
      {!isActive && subtitle && (
        <div className="px-3 pb-3 -mt-1">
          <p className="text-detail text-faint line-clamp-2">{subtitle}</p>
        </div>
      )}

      {/* Expanded body: primary text (auto-resize) + headline */}
      {isActive && (
        <div className="px-3 pb-3 pt-0 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <AlignLeft size={10} /> Primary text
            </label>
            <textarea
              ref={textareaRef}
              value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <Type size={10} /> Headline
            </label>
            <input
              type="text"
              value={variation.headline}
              onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CTA Dropdown ────────────────────────────────────────────────── */

function CtaDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-dim uppercase tracking-wider mb-1">CTA Button</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-2xl text-sm text-ink hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-teal/20"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={14} className={`text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-edge-strong shadow-lg overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto py-1">
            {CTA_OPTIONS.map((cta) => (
              <button
                key={cta}
                type="button"
                onClick={() => { onChange(cta); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  cta === value ? 'bg-teal/5 text-teal font-medium' : 'text-ink hover:bg-surface'
                }`}
              >
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
