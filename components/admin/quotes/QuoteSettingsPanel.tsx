// components/admin/quotes/QuoteSettingsPanel.tsx
// Quote-specific Settings UI. Replaces the generic DesignTab for /quotes.
// Three focused cards: Page Background, Header Style, Fonts & Font Colours.
// Drops everything that doesn't apply to single-page quotes (page
// orientation, text-page border, page numbering). All colour inputs use the
// brand-aware ColorPickerField so the user's saved palette is one click away.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ImageIcon, Trash2, Layers, Type } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import ColorPickerField, { setBrandingColors } from '@/components/ui/ColorPickerField';
import Slider from '@/components/ui/Slider';
import { GOOGLE_FONTS } from '@/lib/google-fonts';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import ProposalStyleSection from '@/components/admin/proposals/quote-builder/sections/ProposalStyleSection';
import HeaderStyleCard from './HeaderStyleCard';

interface Props {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
}

const BODY_BG_FALLBACK   = '#ffffff';
const BODY_TEXT_FALLBACK = '#1E2432';

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

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* ───────────── Proposal Style preset (was on Builder) ───────────── */}
      <ProposalStyleSection proposal={proposal} companyId={companyId} onSaved={onSaved} />

      {/* ───────────── Quote Header Background ─────────────
          Independent from the cover splash — edits quote_header_* columns,
          falls back to cover_* for legacy quotes that haven't been diverged. */}
      <HeaderStyleCard
        proposal={proposal}
        companyId={companyId}
        onSaved={onSaved}
        variant="quote-header"
      />

      {/* ───────────── Page Background ───────────── */}
      <SectionCard
        title="Page Background"
        description="What sits behind the quote card and what fills the quote body. Image lives here too so you can see them side by side."
        icon={<Layers size={14} className="text-faint" />}
      >
        <div className="space-y-4">
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

          <div className="pt-3 border-t border-edge">
            <label className="block text-xs font-medium text-prose mb-2">Background image (optional)</label>
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
                  className="w-full h-40 rounded-lg bg-cover bg-center border border-edge-strong"
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
                  <span className="text-edge-hover">·</span>
                  <button
                    type="button"
                    onClick={removeBg}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
                <Slider
                  label="Colour overlay opacity"
                  value={Math.round(bgOverlay * 100)}
                  formatValue={(v) => `${v}%`}
                  onChange={(pct) => {
                    const v = pct / 100;
                    setBgOverlay(v);
                    persist({ bg_image_overlay_opacity: v });
                  }}
                />
                <Slider
                  label="Blur"
                  value={bgBlur}
                  max={30}
                  formatValue={(v) => `${v}px`}
                  onChange={(v) => {
                    setBgBlur(v);
                    persist({ bg_image_blur: v });
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-edge-strong rounded-lg px-4 py-6 text-center hover:border-edge-hover transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={18} className="mx-auto text-faint animate-spin" />
                ) : (
                  <ImageIcon size={18} className="mx-auto text-faint mb-2" />
                )}
                <p className="text-sm text-dim">Upload image (JPG / PNG, ≤ 8 MB)</p>
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ───────────── Fonts & Font Colours ───────────── */}
      <SectionCard
        title="Fonts & Font Colours"
        description="Fine-tune typography and colours inside the quote body. Cover headline font lives here too."
        icon={<Type size={14} className="text-faint" />}
      >
        <div className="space-y-4">
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

          <div className="pt-3 border-t border-edge space-y-3">
            <label className="block text-xs font-medium text-prose">Headline font (cover + price figures)</label>
            <select
              value={titleFontFamily ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                setTitleFontFamily(v);
                persist({ title_font_family: v });
              }}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="">Inherit from company branding</option>
              {GOOGLE_FONTS.map((f) => (
                <option key={f.family} value={f.family}>{f.family}</option>
              ))}
            </select>
            <div>
              <label className="block text-xs text-dim mb-1">Weight</label>
              <select
                value={titleFontWeight ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setTitleFontWeight(v);
                  persist({ title_font_weight: v });
                }}
                className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
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
