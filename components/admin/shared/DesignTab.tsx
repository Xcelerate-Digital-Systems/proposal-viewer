// components/admin/shared/DesignTab.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Upload, Trash2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EntityType = 'proposal' | 'template' | 'document';
type PageOrientation = 'auto' | 'portrait' | 'landscape';

const tableByType: Record<EntityType, string> = {
  proposal: 'proposals',
  template: 'proposal_templates',
  document: 'documents',
};

const storagePrefixByType: Record<EntityType, string> = {
  proposal: 'proposal',
  template: 'template',
  document: 'document',
};

interface DesignTabProps {
  type: EntityType;
  entityId: string;
  companyId: string;
  /** Current bg_image_path from the entity (null = company default) */
  initialBgImagePath: string | null;
  /** Current bg_image_overlay_opacity from the entity (null = company default) */
  initialBgImageOverlayOpacity: number | null;
  /** Current page_orientation from the entity */
  initialPageOrientation?: PageOrientation;
  /** Company-level bg_primary for the preview overlay */
  companyBgPrimary?: string;
  /** Called after a successful save so parent can refresh data if needed */
  onSave?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Orientation icons                                                   */
/* ------------------------------------------------------------------ */

const orientationOptions: { key: PageOrientation; label: string; icon: React.ReactNode }[] = [
  {
    key: 'auto',
    label: 'Auto (match PDF)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M8 5v6M5.5 7.5L8 5l2.5 2.5" />
      </svg>
    ),
  },
  {
    key: 'portrait',
    label: 'Portrait',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="1.5" width="9" height="13" rx="1.5" />
      </svg>
    ),
  },
  {
    key: 'landscape',
    label: 'Landscape',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DesignTab({
  type,
  entityId,
  companyId,
  initialBgImagePath,
  initialBgImageOverlayOpacity,
  initialPageOrientation = 'auto',
  companyBgPrimary = '#0f0f0f',
  onSave,
}: DesignTabProps) {
  const table = tableByType[type];
  const storagePrefix = storagePrefixByType[type];

  /* ── State ─────────────────────────────────────────────────── */
  const [mode, setMode] = useState<'company' | 'custom'>(
    initialBgImagePath !== null || initialBgImageOverlayOpacity !== null ? 'custom' : 'company'
  );
  const [bgImagePath, setBgImagePath] = useState<string | null>(initialBgImagePath);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(
    initialBgImageOverlayOpacity ?? 0.85
  );
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>(initialPageOrientation);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  /* ── Company default state (for comparison / preview) ──────── */
  const [companyBgImageUrl, setCompanyBgImageUrl] = useState<string | null>(null);
  const [companyOverlayOpacity, setCompanyOverlayOpacity] = useState(0.85);

  /* ── Refs ───────────────────────────────────────────────────── */
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  /* ── Load entity bg image URL ──────────────────────────────── */
  useEffect(() => {
    if (bgImagePath) {
      const { data } = supabase.storage
        .from('company-assets')
        .getPublicUrl(bgImagePath);
      setBgImageUrl(data?.publicUrl || null);
    } else {
      setBgImageUrl(null);
    }
  }, [bgImagePath]);

  /* ── Load company default bg image for preview / fallback ─── */
  useEffect(() => {
    const fetchCompanyBg = async () => {
      const { data } = await supabase
        .from('companies')
        .select('bg_image_path, bg_image_overlay_opacity')
        .eq('id', companyId)
        .single();

      if (data) {
        setCompanyOverlayOpacity(data.bg_image_overlay_opacity ?? 0.85);
        if (data.bg_image_path) {
          const { data: urlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          setCompanyBgImageUrl(urlData?.publicUrl || null);
        }
      }
    };
    fetchCompanyBg();
  }, [companyId]);

  /* ── Cleanup debounce on unmount ───────────────────────────── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ── Save logic ────────────────────────────────────────────── */

  const save = useCallback(async () => {
    setSaveStatus('saving');

    const payload: Record<string, string | number | null> = {
      page_orientation: pageOrientation,
    };

    if (mode === 'company') {
      // Reset to company defaults
      payload.bg_image_path = null;
      payload.bg_image_overlay_opacity = null;
    } else {
      payload.bg_image_path = bgImagePath;
      payload.bg_image_overlay_opacity = overlayOpacity;
    }

    await supabase.from(table).update(payload).eq('id', entityId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    onSave?.();
  }, [mode, bgImagePath, overlayOpacity, pageOrientation, table, entityId, onSave]);

  const scheduleSave = useCallback((delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
      debounceRef.current = null;
    }, delay);
  }, [save]);

  /* ── Autosave: watch saveable state ────────────────────────── */
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bgImagePath, overlayOpacity, pageOrientation]);

  /* ── Upload / Remove handlers ──────────────────────────────── */

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `bg-image.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const storagePath = `${companyId}/bg-image/${storagePrefix}-${entityId}/${safeName}`;

      // Remove old image if exists
      if (bgImagePath) {
        await supabase.storage.from('company-assets').remove([bgImagePath]);
      }

      const { error } = await supabase.storage
        .from('company-assets')
        .upload(storagePath, file, { upsert: true });

      if (error) throw error;

      setBgImagePath(storagePath);
      setMode('custom');
    } catch (err) {
      console.error('Failed to upload background image:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (bgImagePath) {
      await supabase.storage.from('company-assets').remove([bgImagePath]);
    }
    setBgImagePath(null);
    setBgImageUrl(null);
  };

  const handleResetToCompany = () => {
    // Don't remove uploaded file from storage — just clear the reference
    setBgImagePath(null);
    setBgImageUrl(null);
    setOverlayOpacity(companyOverlayOpacity);
    setMode('company');
  };

  /* ── Preview image URL (entity override → company default) ── */
  const previewImageUrl = mode === 'custom' ? bgImageUrl : companyBgImageUrl;
  const previewOpacity = mode === 'custom' ? overlayOpacity : companyOverlayOpacity;

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Design Settings</h4>
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-5">
          {/* ── Page Orientation Section ───────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Page Orientation</label>
            <p className="text-[10px] text-gray-400 mb-3">
              Controls the orientation of text pages, pricing, and packages when exported as PDF.
            </p>
            <div className="flex gap-2">
              {orientationOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPageOrientation(opt.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors ${
                    pageOrientation === opt.key
                      ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className={pageOrientation === opt.key ? 'text-[#017C87]' : 'text-gray-400'}>
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Background Image Section ───────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-3">Viewer Background Image</label>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('company')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mode === 'company'
                    ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Company Default
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mode === 'custom'
                    ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Custom
              </button>
            </div>

            {mode === 'company' && (
              <div className="text-xs text-gray-400 bg-white border border-gray-100 rounded-lg p-3">
                {companyBgImageUrl ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-8 rounded border border-gray-200 bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${companyBgImageUrl})` }}
                    />
                    <span>Using company background image with {Math.round(companyOverlayOpacity * 100)}% overlay.</span>
                  </div>
                ) : (
                  <span>No company background image set. Using solid background color.</span>
                )}
              </div>
            )}

            {mode === 'custom' && (
              <div className="space-y-3">
                {/* Upload area / current image */}
                {bgImageUrl ? (
                  <div className="flex items-start gap-3">
                    <div
                      className="w-20 h-14 rounded-lg border border-gray-200 bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${bgImageUrl})` }}
                    />
                    <div className="space-y-1.5">
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Replace
                      </button>
                      <button
                        onClick={handleRemove}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 w-full rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-[#017C87]/40 hover:text-[#017C87] transition-colors disabled:opacity-50 bg-white"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    <span className="text-xs font-medium">Upload background image</span>
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                  }}
                />

                {/* Overlay opacity slider */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Color Overlay Opacity — {Math.round(overlayOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Controls how much the main background color shows over the image.
                  </p>
                </div>

                {/* Reset to company default button */}
                <button
                  onClick={handleResetToCompany}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#017C87] transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset to company default
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live mini-preview */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Preview</label>
          <div
            className="relative w-full h-40 rounded-lg border border-gray-200 overflow-hidden"
            style={{ backgroundColor: companyBgPrimary }}
          >
            {/* Background image layer */}
            {previewImageUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${previewImageUrl})` }}
              />
            )}
            {/* Color overlay layer */}
            {previewImageUrl && (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: companyBgPrimary, opacity: previewOpacity }}
              />
            )}
            {/* Content placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="bg-white/10 border border-white/20 rounded shadow-lg flex items-center justify-center transition-all duration-300"
                style={{
                  width: pageOrientation === 'landscape' ? '8rem' : '6rem',
                  height: pageOrientation === 'landscape' ? '6rem' : '8rem',
                }}
              >
                <span className="text-[10px] text-white/40 font-medium">PDF Page</span>
              </div>
            </div>
            {/* Label */}
            <div className="absolute bottom-2 right-2">
              <span className="text-[9px] text-white/30 bg-black/20 px-1.5 py-0.5 rounded">
                {mode === 'company' ? 'Company Default' : 'Custom Override'}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {previewImageUrl
              ? 'Background image with color overlay applied behind content pages.'
              : 'Solid background color — no image set.'}
          </p>
        </div>
      </div>
    </div>
  );
}