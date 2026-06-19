// components/admin/shared/cover-editor/CoverPreview.tsx
'use client';

import { EyeOff, Building2 } from 'lucide-react';
import { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import { EntityConfig, ResolvedMember, hexToRgba } from './CoverEditorTypes';
import { buildGradientCss } from '@/lib/gradient-stops';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

interface CoverPreviewProps {
  cfg: EntityConfig;
  coverEnabled: boolean;
  displayTitle: string;
  buttonText: string;
  previewSubtitle: string;
  /* Colors */
  colors: CoverColorValues;
  /* Background image */
  imageUrl: string | null;
  /* Company branding */
  companyLogoUrl: string | null;
  companyName: string;
  headingFont?: string | null;
  /** Weight applied to the cover title — must mirror CoverPage so the preview
   *  reflects what the viewer will render. NULL/undefined falls back to the
   *  Tailwind `font-semibold` baked into the className. */
  headingFontWeight?: string | number | null;
  /** Body font + weight for the subtitle / prepared-by row. NULL falls back
   *  to inherited / Tailwind defaults. */
  bodyFont?: string | null;
  bodyFontWeight?: string | number | null;
  /** CTA button font + weight. Cascades to heading font when not set. */
  buttonFont?: string | null;
  buttonFontWeight?: string | number | null;
  /* Client logo */
  showClientLogo: boolean;
  clientLogoUrl: string | null;
  clientLogoTintColor?: string | null;
  /* Date */
  showDate: boolean;
  coverDate: string;
  /* Prepared by */
  showPreparedBy: boolean;
  showAvatar: boolean;
  resolvedMember: ResolvedMember | null;
}

export default function CoverPreview({
  cfg,
  coverEnabled,
  displayTitle,
  buttonText,
  previewSubtitle,
  colors,
  imageUrl,
  companyLogoUrl,
  companyName,
  headingFont,
  headingFontWeight,
  bodyFont,
  bodyFontWeight,
  buttonFont,
  buttonFontWeight,
  showClientLogo,
  clientLogoUrl,
  clientLogoTintColor,
  showDate,
  coverDate,
  showPreparedBy,
  showAvatar,
  resolvedMember,
}: CoverPreviewProps) {
  /* ── Computed background values ────────────────────────────── */
  const previewBg = imageUrl
    ? undefined
    : colors.coverBgStyle === 'solid'
      ? colors.coverBgColor1
      : undefined;

  const previewBgImage = imageUrl
    ? undefined
    : colors.coverBgStyle === 'gradient'
      ? buildGradientCss('gradient', colors.coverGradientType, colors.coverGradientAngle, 50, 50, colors.coverGradientStops)
      : undefined;

  // Overlay alpha is the slider value, end-to-end. The previous version added
  // +0.1 to the last gradient stop for "punch", but that meant 0% on the slider
  // still leaked ~10% colour over the image — which contradicts the label.
  const overlayAlpha = colors.coverOverlayOpacity;
  const previewOverlay = imageUrl && overlayAlpha > 0
    ? colors.coverBgStyle === 'solid'
      ? hexToRgba(colors.coverBgColor1, overlayAlpha)
      : buildGradientCss(
          'gradient',
          colors.coverGradientType,
          colors.coverGradientAngle,
          50, 50,
          colors.coverGradientStops.map((s) => ({ ...s, color: hexToRgba(s.color, overlayAlpha) })),
        )
    : undefined;

  const resolvedHeadingFont = fontFamily(headingFont, undefined);
  const resolvedBodyFont = fontFamily(bodyFont, undefined);
  const resolvedButtonFont = fontFamily(buttonFont || headingFont, undefined);
  const headingWeightStyle = headingFontWeight != null && headingFontWeight !== ''
    ? Number(headingFontWeight) || undefined
    : undefined;
  const bodyWeightStyle = bodyFontWeight != null && bodyFontWeight !== ''
    ? Number(bodyFontWeight) || undefined
    : undefined;
  const buttonWeightStyle = buttonFontWeight != null && buttonFontWeight !== ''
    ? Number(buttonFontWeight) || undefined
    : headingWeightStyle;

  return (
    <div
      className="rounded-lg overflow-hidden relative w-full h-full"
      style={{ backgroundColor: colors.coverBgColor1 }}
    >
      <GoogleFontLoader fonts={[headingFont || null, bodyFont || null, buttonFont || null].filter(Boolean) as string[]} />
      {/* Background layer */}
      {imageUrl ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: previewBg, backgroundImage: previewBgImage }} />
      )}

      {/* Overlay (when background image present) */}
      {imageUrl && previewOverlay && (
        <div
          className="absolute inset-0"
          style={{
            background: previewOverlay.includes('-gradient(') ? previewOverlay : undefined,
            backgroundColor: !previewOverlay.includes('-gradient(') ? previewOverlay : undefined,
          }}
        />
      )}

      {/* Content — mirrors CoverPage.tsx layout */}
      <div className="relative z-10 flex flex-col h-full p-5">
        {/* Top: company logo */}
        <div>
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt={companyName} className="h-5 max-w-[120px] object-contain opacity-90" />
          ) : companyName ? (
            <div className="flex items-center gap-1.5">
              <Building2 size={14} style={{ color: colors.coverSubtitleColor }} />
              <span
                className="text-xs font-medium tracking-wide opacity-90"
                style={{ color: colors.coverTextColor }}
              >
                {companyName}
              </span>
            </div>
          ) : null}
        </div>

        {/* Spacer — pushes content to bottom */}
        <div className="flex-1" />

        {/* Bottom: content block */}
        <div>
          {/* Client logo — tinted via CSS mask when clientLogoTintColor is set */}
          {showClientLogo && clientLogoUrl && (
            clientLogoTintColor ? (
              <div
                className="h-5 w-[100px] mb-2 opacity-90"
                style={{
                  backgroundColor: clientLogoTintColor,
                  WebkitMaskImage: `url("${clientLogoUrl}")`,
                  maskImage: `url("${clientLogoUrl}")`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'left center',
                  maskPosition: 'left center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
                aria-label="Client logo"
              />
            ) : (
              <img src={clientLogoUrl} alt="" loading="lazy" className="h-5 max-w-[100px] object-contain mb-2 opacity-90" />
            )
          )}

          <h2
            className="text-lg font-semibold leading-tight mb-0.5"
            style={{
              color: colors.coverTextColor,
              fontFamily: resolvedHeadingFont || undefined,
              fontWeight: headingWeightStyle,
            }}
          >
            {displayTitle}
          </h2>

          {/* Date */}
          {showDate && coverDate && (
            <p
              className="text-2xs opacity-70 mb-1"
              style={{
                color: colors.coverSubtitleColor,
                fontFamily: resolvedBodyFont || undefined,
                fontWeight: bodyWeightStyle,
              }}
            >
              {coverDate}
            </p>
          )}

          {/* Subtitle */}
          {previewSubtitle && (
            <p
              className="text-xs mb-1"
              style={{
                color: colors.coverSubtitleColor,
                fontFamily: resolvedBodyFont || undefined,
                fontWeight: bodyWeightStyle,
              }}
            >
              {previewSubtitle}
            </p>
          )}

          {/* Prepared-by + avatar */}
          {cfg.fields.preparedBy && showPreparedBy && resolvedMember && (
            <div className="flex items-center gap-1.5 mb-2">
              {showAvatar && resolvedMember.avatar_url && (
                <img src={resolvedMember.avatar_url} alt="" loading="lazy" className="w-4 h-4 rounded-full object-cover" />
              )}
              <span className="text-2xs opacity-80" style={{ color: colors.coverSubtitleColor }}>
                Prepared by {resolvedMember.name}
              </span>
            </div>
          )}

          {/* CTA button */}
          <div className="mt-3">
            <div
              className="inline-block px-4 py-1.5 text-2xs tracking-wider uppercase rounded-sm"
              style={{
                backgroundColor: colors.coverButtonBg,
                color: colors.coverButtonTextColor,
                fontFamily: resolvedButtonFont || undefined,
                fontWeight: buttonWeightStyle ?? 600,
              }}
            >
              {buttonText || cfg.defaultButtonText}
            </div>
          </div>
        </div>
      </div>

      {/* Disabled overlay */}
      {!coverEnabled && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#666] text-sm">
            <EyeOff size={16} />
            Cover page disabled
          </div>
        </div>
      )}
    </div>
  );
}