// components/admin/quotes/QuoteSettingsPanel.tsx
// Quote-specific Settings UI. Replaces the generic DesignTab for /quotes.
// Three focused cards: Page Background, Header Style, Fonts & Font Colours.
// Drops everything that doesn't apply to single-page quotes (page
// orientation, text-page border, page numbering). All colour inputs use the
// brand-aware ColorPickerField so the user's saved palette is one click away.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ImageIcon, Trash2, Layers, Type, Palette, Sparkles } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import ColorPickerField, { setBrandingColors } from '@/components/ui/ColorPickerField';
import { GOOGLE_FONTS } from '@/lib/google-fonts';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import ProposalStyleSection from '@/components/admin/proposals/quote-builder/sections/ProposalStyleSection';

interface Props {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
}

const HEADER_FALLBACK_1 = '#0f0f0f';
const HEADER_FALLBACK_2 = '#1e293b';
const BODY_BG_FALLBACK   = '#ffffff';
const BODY_TEXT_FALLBACK = '#1E2432';

type BgStyle = 'gradient' | 'solid';
type GradientType = 'linear' | 'radial' | 'conic';

export default function QuoteSettingsPanel({ proposal, companyId, onSaved }: Props) {
  const toast = useToast();

  /* ─── Push the company's brand palette into ColorPickerField on mount ─── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('brand_colors')
        .eq('id', companyId)
        .single();
      if (cancelled) return;
      const palette = Array.isArray(data?.brand_colors) ? (data!.brand_colors as string[]) : [];
      setBrandingColors(palette);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  /* ─── Header style ──────────────────────────────────────────────── */
  const [bgStyle, setBgStyle]               = useState<BgStyle>((proposal.cover_bg_style as BgStyle) || 'gradient');
  const [gradientType, setGradientType]     = useState<GradientType>((proposal.cover_gradient_type as GradientType) || 'linear');
  const [gradientAngle, setGradientAngle]   = useState<number>(proposal.cover_gradient_angle ?? 135);
  const [bgColor1, setBgColor1]             = useState(proposal.cover_bg_color_1 ?? HEADER_FALLBACK_1);
  const [bgColor2, setBgColor2]             = useState(proposal.cover_bg_color_2 ?? HEADER_FALLBACK_2);
  const [coverTextColor, setCoverTextColor] = useState(proposal.cover_text_color ?? '#ffffff');
  const [coverSubtitleColor, setCoverSubtitleColor] = useState(proposal.cover_subtitle_color ?? '#ffffffb3');
  const [coverButtonBg, setCoverButtonBg] = useState(proposal.cover_button_bg ?? '#01434A');
  const [coverButtonTextColor, setCoverButtonTextColor] = useState(proposal.cover_button_text_color ?? '#ffffff');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(proposal.cover_overlay_opacity ?? 0.65);

  /* ─── Page background ───────────────────────────────────────────── */
  const [pageBg, setPageBg]                 = useState(proposal.quote_page_bg_color ?? '#eeece6');
  const [bodyBg, setBodyBg]                 = useState(proposal.text_page_bg_color ?? BODY_BG_FALLBACK);
  const [bgImagePath, setBgImagePath]       = useState<string | null>(proposal.bg_image_path);
  const [bgImageUrl, setBgImageUrl]         = useState<string | null>(null);
  const [bgOverlay, setBgOverlay]           = useState<number>(Number(proposal.bg_image_overlay_opacity ?? 0.85));
  const [bgBlur, setBgBlur]                 = useState<number>(proposal.bg_image_blur ?? 0);
  const [uploading, setUploading]           = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /* ─── Fonts & colours ───────────────────────────────────────────── */
  const [bodyText, setBodyText]             = useState(proposal.text_page_text_color ?? BODY_TEXT_FALLBACK);
  const [headingColor, setHeadingColor]     = useState(proposal.text_page_heading_color ?? BODY_TEXT_FALLBACK);
  const [titleFontFamily, setTitleFontFamily] = useState<string | null>(proposal.title_font_family ?? null);
  const [titleFontWeight, setTitleFontWeight] = useState<string | null>(proposal.title_font_weight ?? null);

  /* ─── Resolve bg image URL ──────────────────────────────────────── */
  useEffect(() => {
    if (!bgImagePath) {
      setBgImageUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from('proposals')
      .createSignedUrl(bgImagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setBgImageUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [bgImagePath]);

  /* ─── Save (debounced fire-and-forget on each field change) ─────── */
  const persist = useCallback(async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('proposals').update(patch).eq('id', proposal.id);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved();
  }, [proposal.id, toast, onSaved]);

  /* ─── Upload bg image ───────────────────────────────────────────── */
  const onUpload = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Background image must be 8 MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = safe.split('.').pop() || 'jpg';
      const path = `bg-image/${proposal.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('proposals')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setBgImagePath(path);
      await persist({ bg_image_path: path });
      toast.success('Background uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeBg = async () => {
    if (bgImagePath) {
      await supabase.storage.from('proposals').remove([bgImagePath]).catch(() => {});
    }
    setBgImagePath(null);
    await persist({ bg_image_path: null });
  };

  /* ─── Gradient swatch helper ───────────────────────────────────── */
  function gradientFor(style: BgStyle, type: GradientType, angle: number, c1: string, c2: string): string {
    if (style === 'solid') return c1;
    if (type === 'radial')  return `radial-gradient(circle, ${c1}, ${c2})`;
    if (type === 'conic')   return `conic-gradient(from ${angle}deg, ${c1}, ${c2})`;
    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  }

  /* ─── Mode pickers — combined "Header Style" preset cards ──────── */
  // Treats solid / linear / radial / conic as a single 4-way preset choice
  // so the gradient editor is one decision, not two nested toggles.
  type StyleMode = 'solid' | 'linear' | 'radial' | 'conic';
  const currentMode: StyleMode = bgStyle === 'solid' ? 'solid' : (gradientType as StyleMode);
  const setMode = (m: StyleMode) => {
    if (m === 'solid') {
      setBgStyle('solid');
      persist({ cover_bg_style: 'solid' });
    } else {
      setBgStyle('gradient');
      setGradientType(m);
      persist({ cover_bg_style: 'gradient', cover_gradient_type: m });
    }
  };

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* ───────────── Proposal Style preset (was on Builder) ───────────── */}
      <ProposalStyleSection proposal={proposal} companyId={companyId} onSaved={onSaved} />

      {/* ───────────── Page Background ───────────── */}
      <SectionCard
        title="Page Background"
        description="What sits behind the quote card and what fills the quote body. Image lives here too so you can see them side by side."
        icon={<Layers size={14} className="text-gray-400" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPickerField
              label="Page background (around the card)"
              value={pageBg}
              fallback="#eeece6"
              onChange={(v) => { setPageBg(v); persist({ quote_page_bg_color: v }); }}
            />
            <ColorPickerField
              label="Quote body background"
              value={bodyBg}
              fallback={BODY_BG_FALLBACK}
              onChange={(v) => { setBodyBg(v); persist({ text_page_bg_color: v }); }}
            />
          </div>

          <div className="pt-3 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-2">Background image (optional)</label>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
            {bgImagePath ? (
              <div className="space-y-3">
                <div
                  className="w-full h-40 rounded-lg bg-cover bg-center border border-gray-200"
                  style={{ backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="text-xs text-teal hover:underline"
                  >
                    {uploading ? <Loader2 size={12} className="animate-spin inline" /> : 'Replace'}
                  </button>
                  <span className="text-gray-200">·</span>
                  <button
                    type="button"
                    onClick={removeBg}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Overlay opacity — {Math.round(bgOverlay * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(bgOverlay * 100)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) / 100;
                      setBgOverlay(v);
                      persist({ bg_image_overlay_opacity: v });
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Blur — {bgBlur}px</label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={bgBlur}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setBgBlur(v);
                      persist({ bg_image_blur: v });
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-6 text-center hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={18} className="mx-auto text-gray-300 animate-spin" />
                ) : (
                  <ImageIcon size={18} className="mx-auto text-gray-300 mb-2" />
                )}
                <p className="text-sm text-gray-500">Upload image (JPG / PNG, ≤ 8 MB)</p>
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ───────────── Header Style ───────────── */}
      <SectionCard
        title="Header Style"
        description="The band behind the cover. Pick a fill, tweak colours; the Cover tab adds the image on top."
        icon={<Palette size={14} className="text-gray-400" />}
      >
        <div className="space-y-5">
          {/* Big live preview — sized like the actual cover band */}
          <div
            className="w-full h-32 rounded-lg border border-gray-200"
            style={{ background: gradientFor(bgStyle, gradientType, gradientAngle, bgColor1, bgColor2) }}
          />

          {/* 4-mode picker — solid / linear / radial / conic in one row */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Fill</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { id: 'solid'  as const, label: 'Solid'  },
                { id: 'linear' as const, label: 'Linear' },
                { id: 'radial' as const, label: 'Radial' },
                { id: 'conic'  as const, label: 'Conic'  },
              ]).map((m) => {
                const active = currentMode === m.id;
                const swatch = m.id === 'solid'
                  ? bgColor1
                  : gradientFor('gradient', m.id, gradientAngle, bgColor1, bgColor2);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`p-2 rounded-lg border-2 transition-all text-center ${
                      active ? 'border-teal bg-teal/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-full h-10 rounded mb-1.5"
                      style={{ background: swatch }}
                    />
                    <span className={`text-xs font-medium ${active ? 'text-teal' : 'text-gray-500'}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Angle slider — only for linear + conic */}
          {currentMode !== 'solid' && currentMode !== 'radial' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Angle</label>
                <span className="text-xs text-gray-700 tabular-nums">{gradientAngle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={gradientAngle}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setGradientAngle(v);
                  persist({ cover_gradient_angle: v });
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
              />
            </div>
          )}

          {/* Colors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorPickerField
              label={currentMode === 'solid' ? 'Background' : 'Start'}
              value={bgColor1}
              fallback={HEADER_FALLBACK_1}
              onChange={(v) => { setBgColor1(v); persist({ cover_bg_color_1: v }); }}
            />
            {currentMode !== 'solid' && (
              <ColorPickerField
                label="End"
                value={bgColor2}
                fallback={HEADER_FALLBACK_2}
                onChange={(v) => { setBgColor2(v); persist({ cover_bg_color_2: v }); }}
              />
            )}
          </div>

          {/* Image overlay opacity — applied when the cover image sits on top */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Image overlay opacity</label>
              <span className="text-xs text-gray-700 tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => {
                const v = parseInt(e.target.value) / 100;
                setOverlayOpacity(v);
                persist({ cover_overlay_opacity: v });
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal"
            />
            <p className="text-xs text-gray-400 mt-1">
              How much the fill above shows through the cover image.
            </p>
          </div>

          {/* Header text colors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <ColorPickerField
              label="Header title text"
              value={coverTextColor}
              fallback="#ffffff"
              onChange={(v) => { setCoverTextColor(v); persist({ cover_text_color: v }); }}
            />
            <ColorPickerField
              label="Header subtitle text"
              value={coverSubtitleColor}
              fallback="#ffffffb3"
              onChange={(v) => { setCoverSubtitleColor(v); persist({ cover_subtitle_color: v }); }}
            />
          </div>

          {/* Accept button colors — moved here from the old Cover tab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <ColorPickerField
              label="Accept button"
              value={coverButtonBg}
              fallback="#01434A"
              onChange={(v) => { setCoverButtonBg(v); persist({ cover_button_bg: v }); }}
            />
            <ColorPickerField
              label="Accept button text"
              value={coverButtonTextColor}
              fallback="#ffffff"
              onChange={(v) => { setCoverButtonTextColor(v); persist({ cover_button_text_color: v }); }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ───────────── Fonts & Font Colours ───────────── */}
      <SectionCard
        title="Fonts & Font Colours"
        description="Fine-tune typography and colours inside the quote body. Cover headline font lives here too."
        icon={<Type size={14} className="text-gray-400" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPickerField
              label="Body text"
              value={bodyText}
              fallback={BODY_TEXT_FALLBACK}
              onChange={(v) => { setBodyText(v); persist({ text_page_text_color: v }); }}
            />
            <ColorPickerField
              label="Headings"
              value={headingColor}
              fallback={BODY_TEXT_FALLBACK}
              onChange={(v) => { setHeadingColor(v); persist({ text_page_heading_color: v }); }}
            />
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <label className="block text-xs font-medium text-gray-600">Headline font (cover + price figures)</label>
            <select
              value={titleFontFamily ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                setTitleFontFamily(v);
                persist({ title_font_family: v });
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="">Inherit from company branding</option>
              {GOOGLE_FONTS.map((f) => (
                <option key={f.family} value={f.family}>{f.family}</option>
              ))}
            </select>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Weight</label>
              <select
                value={titleFontWeight ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setTitleFontWeight(v);
                  persist({ title_font_weight: v });
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              >
                <option value="">Inherit</option>
                <option value="300">Light · 300</option>
                <option value="400">Regular · 400</option>
                <option value="500">Medium · 500</option>
                <option value="600">Semibold · 600</option>
                <option value="700">Bold · 700</option>
                <option value="800">Extra Bold · 800</option>
              </select>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
