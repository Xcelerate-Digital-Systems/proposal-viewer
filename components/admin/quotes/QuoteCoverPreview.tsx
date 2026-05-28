// components/admin/quotes/QuoteCoverPreview.tsx
// Compact cover preview for the Quote Settings tab. Reads directly from the
// proposal row to render a cover preview without needing the full CoverEditor
// state machine. Re-renders when proposal.updated_at changes.
'use client';

import { useEffect, useState } from 'react';
import { Building2, Eye } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { buildGradientCss, resolveStops, type GradientType } from '@/lib/gradient-stops';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

interface Props {
  proposal: Proposal;
  companyId: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function QuoteCoverPreview({ proposal, companyId }: Props) {
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('name, logo_path')
        .eq('id', companyId)
        .single();
      if (data) {
        setCompanyName((data.name as string) ?? '');
        const logoPath = data.logo_path as string | null;
        if (logoPath) {
          const { data: url } = await supabase.storage.from('proposals').createSignedUrl(logoPath, 3600);
          if (url?.signedUrl) setCompanyLogoUrl(url.signedUrl);
        }
      }
    })();
  }, [companyId]);

  useEffect(() => {
    const path = proposal.cover_image_path;
    if (!path) { setImageUrl(null); return; }
    supabase.storage.from('proposals').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setImageUrl(data.signedUrl);
    });
  }, [proposal.cover_image_path]);

  const bgStyle = (proposal.cover_bg_style as string) || 'gradient';
  const gradientType = ((proposal.cover_gradient_type as string) || 'linear') as GradientType;
  const angle = (proposal.cover_gradient_angle as number) ?? 135;
  const color1 = (proposal.cover_bg_color_1 as string) || '#0f0f0f';
  const color2 = (proposal.cover_bg_color_2 as string) || '#1e293b';
  const stops = resolveStops(proposal.cover_gradient_stops, color1, color2);
  const textColor = (proposal.cover_text_color as string) || '#ffffff';
  const subtitleColor = (proposal.cover_subtitle_color as string) || '#ffffffb3';
  const overlayOpacity = Number(proposal.cover_overlay_opacity ?? 0.65);

  const bgCss = bgStyle === 'solid'
    ? color1
    : buildGradientCss('gradient', gradientType, angle, 50, 50, stops);
  const isSolid = bgStyle === 'solid';

  const overlayBg = imageUrl && overlayOpacity > 0
    ? isSolid
      ? hexToRgba(color1, overlayOpacity)
      : buildGradientCss('gradient', gradientType, angle, 50, 50,
          stops.map((s) => ({ ...s, color: hexToRgba(s.color, overlayOpacity) })))
    : undefined;

  const titleFont = proposal.title_font_family as string | null;
  const titleWeight = proposal.title_font_weight as string | null;
  const subtitle = proposal.cover_subtitle || (proposal.client_name ? `Prepared for ${proposal.client_name}` : '');
  const buttonText = proposal.cover_button_text || 'View Quote';
  const buttonBg = (proposal.cover_button_bg as string) || textColor;
  const buttonTextColor = (proposal.cover_button_text_color as string) || color1;

  return (
    <div className="bg-white rounded-2xl border border-edge-strong overflow-hidden">
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-b border-edge bg-surface">
        <Eye size={12} className="text-dim" />
        <span className="text-xs font-medium text-dim">Cover Preview</span>
      </div>
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '16 / 10', backgroundColor: color1 }}
      >
        <GoogleFontLoader fonts={[titleFont].filter(Boolean) as string[]} />

        {/* Background */}
        {imageUrl ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
        ) : (
          <div
            className="absolute inset-0"
            style={isSolid ? { backgroundColor: bgCss } : { backgroundImage: bgCss }}
          />
        )}

        {/* Overlay */}
        {overlayBg && (
          <div
            className="absolute inset-0"
            style={overlayBg.includes('-gradient(') ? { background: overlayBg } : { backgroundColor: overlayBg }}
          />
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-5">
          <div>
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName} className="h-5 max-w-[120px] object-contain opacity-90" />
            ) : companyName ? (
              <div className="flex items-center gap-1.5">
                <Building2 size={14} style={{ color: subtitleColor }} />
                <span className="text-xs font-medium tracking-wide opacity-90" style={{ color: textColor }}>
                  {companyName}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex-1" />
          <div>
            <h2
              className="text-lg font-semibold leading-tight mb-0.5"
              style={{
                color: textColor,
                fontFamily: fontFamily(titleFont, undefined) || undefined,
                fontWeight: titleWeight ? Number(titleWeight) : undefined,
              }}
            >
              {proposal.title || 'Untitled Quote'}
            </h2>
            {subtitle && (
              <p className="text-xs mb-1" style={{ color: subtitleColor }}>{subtitle}</p>
            )}
            <div className="mt-3">
              <div
                className="inline-block px-4 py-1.5 text-2xs tracking-wider uppercase rounded-sm"
                style={{ backgroundColor: buttonBg, color: buttonTextColor, fontWeight: 600 }}
              >
                {buttonText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
