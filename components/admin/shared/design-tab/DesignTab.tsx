// components/admin/shared/design-tab/DesignTab.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  EntityType,
  PageOrientation,
  TextPageDefaults,
  FALLBACK_DEFAULTS,
  SaveStatus,
  tableByType,
  storagePrefixByType,
} from './DesignTabTypes';
import ViewerStyleSection from './ViewerStyleSection';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DesignTabProps {
  type: EntityType;
  entityId: string;
  companyId: string;
  initialBgImagePath: string | null;
  initialBgImageOverlayOpacity: number | null;
  initialPageOrientation?: PageOrientation;
  companyBgPrimary?: string;
  onSave?: () => void;
  initialTextPageBgColor?: string | null;
  initialTextPageTextColor?: string | null;
  initialTextPageHeadingColor?: string | null;
  initialTextPageFontSize?: string | null;
  initialTextPageBorderEnabled?: boolean | null;
  initialTextPageBorderColor?: string | null;
  initialTextPageBorderRadius?: string | null;
  initialTextPageLayout?: string | null;
  initialTitleFontFamily?: string | null;
  initialTitleFontWeight?: string | null;
  initialTitleFontSize?: string | null;
  initialPageNumCircleColor?: string | null;
  initialPageNumTextColor?: string | null;
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
  initialPageOrientation = 'portrait',
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
  initialPageNumCircleColor,
  initialPageNumTextColor,
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

  /* ================================================================ */
  /*  TITLE FONT STATE                                                 */
  /* ================================================================ */

  const [titleFontFamily, setTitleFontFamily] = useState<string | null>(initialTitleFontFamily ?? null);
  const [titleFontWeight, setTitleFontWeight] = useState<string | null>(initialTitleFontWeight ?? null);
  const [titleFontSize, setTitleFontSize] = useState<string>(initialTitleFontSize || '');

  /* ================================================================ */
  /*  PAGE NUMBER BADGE STATE                                          */
  /* ================================================================ */

  const [pageNumCircleColor, setPageNumCircleColor] = useState<string | null>(
  initialPageNumCircleColor ?? null
);
const [pageNumTextColor, setPageNumTextColor] = useState<string | null>(
  initialPageNumTextColor ?? null
);

  /* ================================================================ */
  /*  SAVE STATUS + REFS                                               */
  /* ================================================================ */

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const tpInitializedRef = useRef(false);
  const titleFontInitializedRef = useRef(false);
  const pageNumInitializedRef = useRef(false);

  /* ================================================================ */
  /*  COMPANY DEFAULTS                                                 */
  /* ================================================================ */

  const [companyTpDefaults, setCompanyTpDefaults] = useState<TextPageDefaults>(FALLBACK_DEFAULTS);

  useEffect(() => {
    const fetchCompanyDefaults = async () => {
      const { data: companyData } = await supabase
        .from('companies')
        .select('bg_image_path, bg_image_overlay_opacity, bg_secondary, text_page_bg_color, text_page_text_color, text_page_heading_color, text_page_font_size, text_page_border_enabled, text_page_border_color, text_page_border_radius, accent_color, sidebar_text_color, cover_text_color, cover_subtitle_color, font_heading, font_body')
        .eq('id', companyId)
        .single();

      if (companyData) {
        if (companyData.bg_image_path) {
          const { data: urlData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(companyData.bg_image_path);
          if (urlData?.publicUrl) setCompanyBgImageUrl(urlData.publicUrl);
        }
        setCompanyOverlayOpacity(companyData.bg_image_overlay_opacity ?? 0.85);

        const defaults: TextPageDefaults = {
          bg_color: companyData.text_page_bg_color || FALLBACK_DEFAULTS.bg_color,
          text_color: companyData.text_page_text_color || FALLBACK_DEFAULTS.text_color,
          heading_color: companyData.text_page_heading_color || FALLBACK_DEFAULTS.heading_color,
          font_size: companyData.text_page_font_size || FALLBACK_DEFAULTS.font_size,
          border_enabled: companyData.text_page_border_enabled ?? FALLBACK_DEFAULTS.border_enabled,
          border_color: companyData.text_page_border_color || FALLBACK_DEFAULTS.border_color,
          border_radius: companyData.text_page_border_radius || FALLBACK_DEFAULTS.border_radius,
          accent_color: companyData.accent_color || FALLBACK_DEFAULTS.accent_color,
          sidebar_text_color: companyData.sidebar_text_color || FALLBACK_DEFAULTS.sidebar_text_color,
          bg_secondary: companyData.bg_secondary || FALLBACK_DEFAULTS.bg_secondary,
          cover_text_color: companyData.cover_text_color || FALLBACK_DEFAULTS.cover_text_color,
          cover_subtitle_color: companyData.cover_subtitle_color || FALLBACK_DEFAULTS.cover_subtitle_color,
          font_heading: companyData.font_heading || FALLBACK_DEFAULTS.font_heading,
          font_body: companyData.font_body || FALLBACK_DEFAULTS.font_body,
        };
        setCompanyTpDefaults(defaults);

        if (initialTextPageBgColor == null) {
          setTpBgColor(defaults.bg_color);
          setTpTextColor(defaults.text_color);
          setTpHeadingColor(defaults.heading_color);
        }
      }
    };
    fetchCompanyDefaults();
  }, [companyId, initialTextPageBgColor]);

  // Fetch entity bg image URL
  useEffect(() => {
    if (!bgImagePath) return;
    const { data } = supabase.storage
      .from('company-assets')
      .getPublicUrl(bgImagePath);
    if (data?.publicUrl) setBgImageUrl(data.publicUrl);
  }, [bgImagePath]);

  // Cleanup debounce on unmount
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
    payload.text_page_bg_color = tpBgColor;
    payload.text_page_text_color = tpTextColor;
    payload.text_page_heading_color = tpHeadingColor || null;
    payload.text_page_font_size = null;
    payload.text_page_layout = 'full';
    payload.title_font_family = titleFontFamily;
    payload.title_font_weight = titleFontWeight;
    payload.title_font_size = titleFontSize || null;
    payload.page_num_circle_color = pageNumCircleColor ?? null;
    payload.page_num_text_color = pageNumTextColor ?? null;

    await supabase.from(table).update(payload).eq('id', entityId);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    onSave?.();
  }, [
    bgMode, bgImagePath, overlayOpacity, pageOrientation,
    tpBgColor, tpTextColor, tpHeadingColor,
    titleFontFamily, titleFontWeight, titleFontSize,
    pageNumCircleColor, pageNumTextColor,
    table, entityId, onSave,
  ]);

  const scheduleSave = useCallback((delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
      debounceRef.current = null;
    }, delay);
  }, [save]);

  // Autosave: bg image state
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    scheduleSave(800);
  }, [bgMode, bgImagePath, overlayOpacity, pageOrientation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: text page state
  useEffect(() => {
    if (!tpInitializedRef.current) { tpInitializedRef.current = true; return; }
    scheduleSave(800);
  }, [tpBgColor, tpTextColor, tpHeadingColor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: title font state
  useEffect(() => {
    if (!titleFontInitializedRef.current) { titleFontInitializedRef.current = true; return; }
    scheduleSave(800);
  }, [titleFontFamily, titleFontWeight, titleFontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: page number badge state
  useEffect(() => {
    if (!pageNumInitializedRef.current) { pageNumInitializedRef.current = true; return; }
    scheduleSave(800);
  }, [pageNumCircleColor, pageNumTextColor]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================================================================ */
  /*  BACKGROUND IMAGE HANDLERS                                        */
  /* ================================================================ */

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const sanitized = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${storagePrefix}-bg/${entityId}/${sanitized}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setBgImagePath(path);
      setBgMode('custom');
      const { data } = supabase.storage.from('company-assets').getPublicUrl(path);
      if (data?.publicUrl) setBgImageUrl(data.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setBgImagePath(null);
    setBgImageUrl(null);
    setBgMode('company');
  };

  const handleBgResetToCompany = () => {
    setBgMode('company');
    setBgImagePath(null);
    setBgImageUrl(null);
    setOverlayOpacity(companyOverlayOpacity);
  };

  const handleTpResetToCompany = () => {
    setTpBgColor(companyTpDefaults.bg_color);
    setTpTextColor(companyTpDefaults.text_color);
    setTpHeadingColor(companyTpDefaults.heading_color);
  };

  /* ================================================================ */
  /*  PREVIEW IMAGE                                                    */
  /* ================================================================ */

  const previewImageUrl = bgMode === 'company' ? companyBgImageUrl : bgImageUrl;
  const previewOpacity = bgMode === 'company' ? companyOverlayOpacity : overlayOpacity;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <ViewerStyleSection
      type={type}
      saveStatus={saveStatus}
      pageOrientation={pageOrientation}
      setPageOrientation={setPageOrientation}
      bgMode={bgMode}
      setBgMode={setBgMode}
      bgImageUrl={bgImageUrl}
      uploading={uploading}
      overlayOpacity={overlayOpacity}
      setOverlayOpacity={setOverlayOpacity}
      companyBgPrimary={companyBgPrimary}
      previewImageUrl={previewImageUrl}
      previewOpacity={previewOpacity}
      onUpload={handleUpload}
      onRemove={handleRemove}
      onBgResetToCompany={handleBgResetToCompany}
      titleFontFamily={titleFontFamily}
      setTitleFontFamily={setTitleFontFamily}
      titleFontWeight={titleFontWeight}
      setTitleFontWeight={setTitleFontWeight}
      titleFontSize={titleFontSize}
      setTitleFontSize={setTitleFontSize}
      tpBgColor={tpBgColor}
      setTpBgColor={setTpBgColor}
      tpTextColor={tpTextColor}
      setTpTextColor={setTpTextColor}
      tpHeadingColor={tpHeadingColor}
      setTpHeadingColor={setTpHeadingColor}
      companyDefaults={companyTpDefaults}
      onTpResetToCompany={handleTpResetToCompany}
      pageNumCircleColor={pageNumCircleColor}
      setPageNumCircleColor={setPageNumCircleColor}
      pageNumTextColor={pageNumTextColor}
      setPageNumTextColor={setPageNumTextColor}
    />
  );
}