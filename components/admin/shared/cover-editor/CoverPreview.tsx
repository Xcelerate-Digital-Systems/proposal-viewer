// components/admin/shared/cover-editor/CoverPreview.tsx
'use client';

import { EyeOff, Building2 } from 'lucide-react';
import { CoverColorValues } from '@/components/admin/shared/CoverColorControls';
import { EntityConfig, ResolvedMember, hexToRgba, buildGradient } from './CoverEditorTypes';

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
  /* Client logo */
  showClientLogo: boolean;
  clientLogoUrl: string | null;
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
  showClientLogo,
  clientLogoUrl,
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
      ? buildGradient(colors.coverGradientType, colors.coverGradientAngle, colors.coverBgColor1, colors.coverBgColor2)
      : undefined;

  const overlayEnd = Math.min(1, colors.coverOverlayOpacity + 0.1);
  const previewOverlay = imageUrl
    ? colors.coverBgStyle === 'solid'
      ? hexToRgba(colors.coverBgColor1, colors.coverOverlayOpacity)
      : buildGradient(
          colors.coverGradientType,
          colors.coverGradientAngle,
          hexToRgba(colors.coverBgColor1, colors.coverOverlayOpacity),
          hexToRgba(colors.coverBgColor2, overlayEnd),
        )
    : undefined;

  return (
    <div
      className="rounded-lg overflow-hidden border border-gray-200 relative h-full"
      style={{ backgroundColor: colors.coverBgColor1 }}
    >
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
          {/* Client logo */}
          {showClientLogo && clientLogoUrl && (
            <img src={clientLogoUrl} alt="" className="h-5 max-w-[100px] object-contain mb-2 opacity-90" />
          )}

          <h2
            className="text-lg font-semibold leading-tight mb-0.5 font-[family-name:var(--font-display)]"
            style={{ color: colors.coverTextColor }}
          >
            {displayTitle}
          </h2>

          {/* Date */}
          {showDate && coverDate && (
            <p className="text-[10px] opacity-70 mb-1" style={{ color: colors.coverSubtitleColor }}>
              {coverDate}
            </p>
          )}

          {/* Subtitle */}
          {previewSubtitle && (
            <p className="text-xs mb-1" style={{ color: colors.coverSubtitleColor }}>
              {previewSubtitle}
            </p>
          )}

          {/* Prepared-by + avatar */}
          {cfg.fields.preparedBy && showPreparedBy && resolvedMember && (
            <div className="flex items-center gap-1.5 mb-2">
              {showAvatar && resolvedMember.avatar_url && (
                <img src={resolvedMember.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              <span className="text-[10px] opacity-80" style={{ color: colors.coverSubtitleColor }}>
                Prepared by {resolvedMember.name}
              </span>
            </div>
          )}

          {/* CTA button */}
          <div className="mt-3">
            <div
              className="inline-block px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase rounded-sm"
              style={{ backgroundColor: colors.coverButtonBg, color: colors.coverButtonTextColor }}
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