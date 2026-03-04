// components/admin/shared/DesignTab.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Loader2, Upload, Trash2, Image as ImageIcon, RotateCcw, FileText, Type } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TextPagePreview from '@/components/admin/company/TextPagePreview';
import FontSelect from '@/components/admin/shared/FontSelect';

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

/* ------------------------------------------------------------------ */
/*  Text page style defaults (match company table defaults)            */
/* ------------------------------------------------------------------ */

interface TextPageDefaults {
  bg_color: string;
  text_color: string;
  heading_color: string;
  font_size: string;
  border_enabled: boolean;
  border_color: string;
  border_radius: string;
  accent_color: string;
}

const FALLBACK_DEFAULTS: TextPageDefaults = {
  bg_color: '#141414',
  text_color: '#ffffff',
  heading_color: '',
  font_size: '14',
  border_enabled: true,
  border_color: '',
  border_radius: '12',
  accent_color: '#ff6700',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

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
  /** Entity-level text page overrides (null = use company default) */
  initialTextPageBgColor?: string | null;
  initialTextPageTextColor?: string | null;
  initialTextPageHeadingColor?: string | null;
  initialTextPageFontSize?: string | null;
  initialTextPageBorderEnabled?: boolean | null;
  initialTextPageBorderColor?: string | null;
  initialTextPageBorderRadius?: string | null;
  initialTextPageLayout?: string | null;
  /** Entity-level title font settings (null = use company heading font) */
  initialTitleFontFamily?: string | null;
  initialTitleFontWeight?: string | null;
  initialTitleFontSize?: string | null;
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
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function isValidHex6(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Small inline color picker row matching the company branding page style */
function ColorRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <label className="text-xs text-gray-500 whitespace-nowrap">{label}</label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex6(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: 2 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#000000"
          className="w-[90px] px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#017C87]/30 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}

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
  initialTextPageBgColor,
  initialTextPageTextColor,
  initialTextPageHeadingColor,
  initialTextPageBorderEnabled,
  initialTextPageBorderColor,
  initialTextPageBorderRadius,
  initialTitleFontFamily,
  initialTitleFontWeight,
  initialTitleFontSize,
}: DesignTabProps) {
  const table = tableByType[type];
  const storagePrefix = storagePrefixByType[type];

  /* ================================================================ */
  /*  BACKGROUND IMAGE STATE                                           */
  /* ================================================================ */

  const [bgMode, setBgMode] = useState<'company' | 'custom'>(
    initialBgImagePath !== null || initialBgImageOverlayOpacity !== null ? 'custom' : 'company'
  );
  const [bgImagePath, setBgImagePath] = useState<string | null>(initialBgImagePath);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(
    initialBgImageOverlayOpacity ?? 0.85
  );
  const [uploading, setUploading] = useState(false);

  /* ── Company bg defaults ───────────────────────────────────── */
  const [companyBgImageUrl, setCompanyBgImageUrl] = useState<string | null>(null);
  const [companyOverlayOpacity, setCompanyOverlayOpacity] = useState(0.85);

  /* ================================================================ */
  /*  PAGE ORIENTATION STATE                                           */
  /* ================================================================ */

  const [pageOrientation, setPageOrientation] = useState<PageOrientation>(initialPageOrientation);

  /* ================================================================ */
  /*  TEXT PAGE STYLE STATE                                            */
  /* ================================================================ */

  const [tpBgColor, setTpBgColor] = useState(initialTextPageBgColor || FALLBACK_DEFAULTS.bg_color);
  const [tpTextColor, setTpTextColor] = useState(initialTextPageTextColor || FALLBACK_DEFAULTS.text_color);
  const [tpHeadingColor, setTpHeadingColor] = useState(initialTextPageHeadingColor || FALLBACK_DEFAULTS.heading_color);
  const [tpBorderEnabled, setTpBorderEnabled] = useState(initialTextPageBorderEnabled ?? FALLBACK_DEFAULTS.border_enabled);
  const [tpBorderColor, setTpBorderColor] = useState(initialTextPageBorderColor || FALLBACK_DEFAULTS.border_color);
  const [tpBorderRadius, setTpBorderRadius] = useState(initialTextPageBorderRadius || FALLBACK_DEFAULTS.border_radius);

  /* ================================================================ */
  /*  TITLE FONT STATE                                                 */
  /* ================================================================ */

  const [titleFontFamily, setTitleFontFamily] = useState<string | null>(initialTitleFontFamily ?? null);
  const [titleFontWeight, setTitleFontWeight] = useState<string | null>(initialTitleFontWeight ?? null);
  const [titleFontSize, setTitleFontSize] = useState<string>(initialTitleFontSize || '');

  /* ================================================================ */
  /*  SAVE STATUS + REFS                                               */
  /* ================================================================ */

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const tpInitializedRef = useRef(false);
  const titleFontInitializedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ================================================================ */
  /*  COMPANY DEFAULTS                                                 */
  /* ================================================================ */

  const [companyTpDefaults, setCompanyTpDefaults] = useState<TextPageDefaults>(FALLBACK_DEFAULTS);

  useEffect(() => {
    const fetchCompanyDefaults = async () => {
      // Fetch company bg image
      const { data: companyData } = await supabase
        .from('companies')
        .select('bg_image_path, bg_image_overlay_opacity, text_page_bg_color, text_page_text_color, text_page_heading_color, text_page_font_size, text_page_border_enabled, text_page_border_color, text_page_border_radius, accent_color')
        .eq('id', companyId)
        .single();

      if (companyData) {
        // Company bg image
        if (companyData.bg_image_path) {
          const { data: urlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(companyData.bg_image_path);
          if (urlData?.publicUrl) setCompanyBgImageUrl(urlData.publicUrl);
        }
        setCompanyOverlayOpacity(companyData.bg_image_overlay_opacity ?? 0.85);

        // Company text page defaults
        const defaults: TextPageDefaults = {
          bg_color: companyData.text_page_bg_color || FALLBACK_DEFAULTS.bg_color,
          text_color: companyData.text_page_text_color || FALLBACK_DEFAULTS.text_color,
          heading_color: companyData.text_page_heading_color || FALLBACK_DEFAULTS.heading_color,
          font_size: companyData.text_page_font_size || FALLBACK_DEFAULTS.font_size,
          border_enabled: companyData.text_page_border_enabled ?? FALLBACK_DEFAULTS.border_enabled,
          border_color: companyData.text_page_border_color || FALLBACK_DEFAULTS.border_color,
          border_radius: companyData.text_page_border_radius || FALLBACK_DEFAULTS.border_radius,
          accent_color: companyData.accent_color || FALLBACK_DEFAULTS.accent_color,
        };
        setCompanyTpDefaults(defaults);

        // If no entity-level overrides exist, sync to company values
        if (initialTextPageBgColor == null) {
          setTpBgColor(defaults.bg_color);
          setTpTextColor(defaults.text_color);
          setTpHeadingColor(defaults.heading_color);
          setTpBorderEnabled(defaults.border_enabled);
          setTpBorderColor(defaults.border_color);
          setTpBorderRadius(defaults.border_radius);
        }
      }
    };
    fetchCompanyDefaults();
  }, [companyId, initialTextPageBgColor]);

  // Fetch entity bg image signed URL
  useEffect(() => {
    if (!bgImagePath) return;
    const { data } = supabase.storage
      .from('company-assets')
      .getPublicUrl(bgImagePath);
    if (data?.publicUrl) setBgImageUrl(data.publicUrl);
  }, [bgImagePath]);

  /** Cleanup debounce on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ================================================================ */
  /*  SAVE LOGIC                                                       */
  /* ================================================================ */

  const save = useCallback(async () => {
    setSaveStatus('saving');

    const payload: Record<string, string | number | boolean | null> = {
      page_orientation: pageOrientation,
    };

    // Background image
    if (bgMode === 'company') {
      payload.bg_image_path = null;
      payload.bg_image_overlay_opacity = null;
    } else {
      payload.bg_image_path = bgImagePath;
      payload.bg_image_overlay_opacity = overlayOpacity;
    }

    // Text page style — always save values directly
    payload.text_page_bg_color = tpBgColor;
    payload.text_page_text_color = tpTextColor;
    payload.text_page_heading_color = tpHeadingColor || null;
    payload.text_page_font_size = null; // Font size handled in text editor
    payload.text_page_border_enabled = tpBorderEnabled;
    payload.text_page_border_color = tpBorderColor || null;
    payload.text_page_border_radius = tpBorderRadius;
    payload.text_page_layout = 'full'; // Always full width

    // Title font
    payload.title_font_family = titleFontFamily;
    payload.title_font_weight = titleFontWeight;
    payload.title_font_size = titleFontSize || null;

    await supabase.from(table).update(payload).eq('id', entityId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    onSave?.();
  }, [
    bgMode, bgImagePath, overlayOpacity, pageOrientation,
    tpBgColor, tpTextColor, tpHeadingColor,
    tpBorderEnabled, tpBorderColor, tpBorderRadius,
    titleFontFamily, titleFontWeight, titleFontSize,
    table, entityId, onSave,
  ]);

  const scheduleSave = useCallback((delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
      debounceRef.current = null;
    }, delay);
  }, [save]);

  /* ── Autosave: watch bg image state ────────────────────────── */
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgMode, bgImagePath, overlayOpacity, pageOrientation]);

  /* ── Autosave: watch text page state ───────────────────────── */
  useEffect(() => {
    if (!tpInitializedRef.current) {
      tpInitializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpBgColor, tpTextColor, tpHeadingColor, tpBorderEnabled, tpBorderColor, tpBorderRadius]);

  /* ── Autosave: watch title font state ──────────────────────── */
  useEffect(() => {
    if (!titleFontInitializedRef.current) {
      titleFontInitializedRef.current = true;
      return;
    }
    scheduleSave(800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleFontFamily, titleFontWeight, titleFontSize]);

  /* ================================================================ */
  /*  BACKGROUND IMAGE HANDLERS                                        */
  /* ================================================================ */

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `bg-image.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const storagePath = `${companyId}/bg-image/${storagePrefix}-${entityId}/${safeName}`;

      if (bgImagePath) {
        await supabase.storage.from('company-assets').remove([bgImagePath]);
      }

      const { error } = await supabase.storage
        .from('company-assets')
        .upload(storagePath, file, { upsert: true });

      if (error) throw error;

      setBgImagePath(storagePath);
      setBgMode('custom');
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

  const handleBgResetToCompany = () => {
    setBgImagePath(null);
    setBgImageUrl(null);
    setOverlayOpacity(companyOverlayOpacity);
    setBgMode('company');
  };

  /* ================================================================ */
  /*  TEXT PAGE HANDLERS                                                */
  /* ================================================================ */

  const handleTpResetToCompany = () => {
    setTpBgColor(companyTpDefaults.bg_color);
    setTpTextColor(companyTpDefaults.text_color);
    setTpHeadingColor(companyTpDefaults.heading_color);
    setTpBorderEnabled(companyTpDefaults.border_enabled);
    setTpBorderColor(companyTpDefaults.border_color);
    setTpBorderRadius(companyTpDefaults.border_radius);
  };

  /* ================================================================ */
  /*  DERIVED VALUES                                                   */
  /* ================================================================ */

  const previewImageUrl = bgMode === 'custom' ? bgImageUrl : companyBgImageUrl;
  const previewOpacity = bgMode === 'custom' ? overlayOpacity : companyOverlayOpacity;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-5">
      {/* ──────────────────────────────────────────────────────────── */}
      {/*  SECTION 1: Page Orientation + Background Image              */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Viewer Background</h4>
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
                  onClick={() => setBgMode('company')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    bgMode === 'company'
                      ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Company Default
                </button>
                <button
                  onClick={() => setBgMode('custom')}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    bgMode === 'custom'
                      ? 'bg-[#017C87]/10 border-[#017C87]/40 text-[#017C87] font-medium'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Custom Override
                </button>
              </div>

              {bgMode === 'custom' && (
                <>
                  {/* Upload / preview area */}
                  {bgImageUrl ? (
                    <div className="mb-3">
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200">
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${bgImageUrl})` }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{ backgroundColor: companyBgPrimary, opacity: overlayOpacity }}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                      Higher = more color, less image.
                    </p>
                  </div>

                  {/* Reset to company default button */}
                  <button
                    onClick={handleBgResetToCompany}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#017C87] transition-colors mt-2"
                  >
                    <RotateCcw size={12} />
                    Reset to company default
                  </button>
                </>
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
              {previewImageUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${previewImageUrl})` }}
                />
              )}
              {previewImageUrl && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: companyBgPrimary, opacity: previewOpacity }}
                />
              )}
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
              <div className="absolute bottom-2 right-2">
                <span className="text-[9px] text-white/30 bg-black/20 px-1.5 py-0.5 rounded">
                  {bgMode === 'company' ? 'Company Default' : 'Custom Override'}
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  SECTION: Page Title Font                                    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Type size={15} className="text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900">Page Title Font</h4>
          </div>
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

        <p className="text-xs text-gray-400 mb-4">
          Font used for page titles on Table of Contents, Pricing, Text Pages &amp; Packages.
          Leave as system default to use your company heading font.
        </p>

        <div className="space-y-4">
          <FontSelect
            label="Title Font"
            description="Applied to all page titles in the viewer"
            value={titleFontFamily}
            onChange={setTitleFontFamily}
            previewText="Your Page Title"
            weight={titleFontWeight}
            onWeightChange={setTitleFontWeight}
          />

          {/* Font size */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title Size</label>
            <select
              value={titleFontSize}
              onChange={(e) => setTitleFontSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#017C87]/30"
            >
              <option value="">Default</option>
              <option value="20">20px — Small</option>
              <option value="24">24px — Medium</option>
              <option value="28">28px</option>
              <option value="32">32px — Large</option>
              <option value="36">36px</option>
              <option value="40">40px — Extra Large</option>
              <option value="48">48px</option>
            </select>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/*  SECTION: Text Page Style                                    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900">Text Page Style</h4>
          </div>
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
          <div>
            <p className="text-xs text-gray-400 mb-4">
              Styling for text pages in this {type}. Changes save automatically.
            </p>

            <div className="space-y-4">
              {/* Colors */}
              <ColorRow label="Background Color" value={tpBgColor} onChange={setTpBgColor} />
              <ColorRow label="Text Color" value={tpTextColor} onChange={setTpTextColor} />
              <ColorRow label="Heading Color" value={tpHeadingColor} onChange={setTpHeadingColor} />

              {/* Border toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Border</label>
                <button
                  onClick={() => setTpBorderEnabled(!tpBorderEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    tpBorderEnabled ? 'bg-[#017C87]' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                    tpBorderEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Border color — only show when border enabled */}
              {tpBorderEnabled && (
                <ColorRow label="Border Color (optional)" value={tpBorderColor} onChange={setTpBorderColor} />
              )}

              {/* Border radius */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Border Radius (px)</label>
                <select
                  value={tpBorderRadius}
                  onChange={(e) => setTpBorderRadius(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#017C87]/30"
                >
                  {['0', '4', '8', '12', '16', '20', '24'].map(r => (
                    <option key={r} value={r}>{r}px{r === '0' ? ' (square)' : r === '24' ? ' (very round)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Reset button */}
              <button
                onClick={handleTpResetToCompany}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#017C87] transition-colors"
              >
                <RotateCcw size={12} />
                Reset to company defaults
              </button>
            </div>
          </div>

          {/* Right: Live preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">Preview</p>
            </div>
            <TextPagePreview
              bgColor={tpBgColor || '#141414'}
              textColor={tpTextColor || '#ffffff'}
              headingColor={tpHeadingColor}
              fontSize={companyTpDefaults.font_size || '14'}
              accent={companyTpDefaults.accent_color}
              borderEnabled={tpBorderEnabled}
              borderColor={tpBorderColor}
              borderRadius={tpBorderRadius || '12'}
              layout="full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}