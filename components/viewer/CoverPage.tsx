// components/viewer/CoverPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Proposal, supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';

interface CoverPageProps {
  proposal: Proposal;
  branding: CompanyBranding;
  onStart: () => void;
  /** Hide the CTA button (used for PDF export capture) */
  hideButton?: boolean;
  /** Pre-resolved cover image URL (bypasses async fetch for export) */
  resolvedBgUrl?: string | null;
  /** Pre-resolved client logo URL (bypasses async fetch for export) */
  resolvedClientLogoUrl?: string | null;
  /** Pre-resolved avatar URL (bypasses async fetch for export) */
  resolvedAvatarUrl?: string | null;
  /** Pre-resolved prepared-by name (bypasses async member lookup for export) */
  resolvedPreparedByName?: string | null;
}

/**
 * Convert a hex color to an rgba string for use in gradients / overlays.
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CoverPage({
  proposal,
  branding,
  onStart,
  hideButton,
  resolvedBgUrl,
  resolvedClientLogoUrl,
  resolvedAvatarUrl,
  resolvedPreparedByName,
}: CoverPageProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(resolvedBgUrl ?? null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(resolvedClientLogoUrl ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(resolvedAvatarUrl ?? null);
  const [loaded, setLoaded] = useState(!!hideButton); // Skip fade-in for export

  // Resolved member data (from prepared_by_member_id when direct fields are absent)
  const [resolvedName, setResolvedName] = useState<string | null>(resolvedPreparedByName ?? null);

  // Fetch signed URL for cover image (skip if pre-resolved)
  useEffect(() => {
    if (resolvedBgUrl !== undefined) return;
    if (proposal.cover_image_path) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(proposal.cover_image_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setBgUrl(data.signedUrl);
        });
    }
  }, [proposal.cover_image_path, resolvedBgUrl]);

  // Fetch signed URL for client logo (skip if pre-resolved)
  useEffect(() => {
    if (resolvedClientLogoUrl !== undefined) return;
    if (proposal.cover_client_logo_path && proposal.cover_show_client_logo) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(proposal.cover_client_logo_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setClientLogoUrl(data.signedUrl);
        });
    }
  }, [proposal.cover_client_logo_path, proposal.cover_show_client_logo, resolvedClientLogoUrl]);

  // Fetch signed URL for avatar (skip if pre-resolved)
  useEffect(() => {
    if (resolvedAvatarUrl !== undefined) return;
    if (proposal.cover_avatar_path && proposal.cover_show_avatar) {
      supabase.storage
        .from('proposals')
        .createSignedUrl(proposal.cover_avatar_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setAvatarUrl(data.signedUrl);
        });
    }
  }, [proposal.cover_avatar_path, proposal.cover_show_avatar, resolvedAvatarUrl]);

  // Resolve prepared_by_member_id → name + avatar when direct fields are absent
  // (skip if pre-resolved)
  useEffect(() => {
    if (resolvedPreparedByName !== undefined) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberId = (proposal as any).prepared_by_member_id;
    if (!memberId) return;

    // Only resolve if we're missing the name or the avatar
    const needsName = !proposal.prepared_by;
    const needsAvatar = !proposal.cover_avatar_path && proposal.cover_show_avatar;
    if (!needsName && !needsAvatar) return;

    const resolve = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('name, avatar_path')
        .eq('id', memberId)
        .single();

      if (!data) return;

      if (needsName && data.name) {
        setResolvedName(data.name);
      }

      if (needsAvatar && data.avatar_path) {
        const { data: urlData } = await supabase.storage
          .from('proposals')
          .createSignedUrl(data.avatar_path, 3600);
        if (urlData?.signedUrl) {
          setAvatarUrl(urlData.signedUrl);
        }
      }
    };
    resolve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(proposal as any).prepared_by_member_id, proposal.prepared_by, proposal.cover_avatar_path, proposal.cover_show_avatar, resolvedPreparedByName]);

  // Wait for cover image to fully load before revealing
  useEffect(() => {
    if (hideButton) return; // Export mode — already visible
    if (proposal.cover_image_path && !bgUrl) return;

    if (bgUrl) {
      const img = new Image();
      img.onload = () => setTimeout(() => setLoaded(true), 50);
      img.onerror = () => setTimeout(() => setLoaded(true), 50);
      img.src = bgUrl;
    } else {
      const timer = setTimeout(() => setLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [bgUrl, proposal.cover_image_path, hideButton]);

  const subtitle = proposal.cover_subtitle || `Prepared for ${proposal.client_name}`;
  const buttonText = proposal.cover_button_text || 'START READING PROPOSAL';

  // Cover colors: read from proposal first, fall back to company branding
  const bgStyle = proposal.cover_bg_style || branding.cover_bg_style || 'gradient';
  const bgColor1 = proposal.cover_bg_color_1 || branding.cover_bg_color_1 || '#0f0f0f';
  const bgColor2 = proposal.cover_bg_color_2 || branding.cover_bg_color_2 || '#141414';
  const textColor = proposal.cover_text_color || branding.cover_text_color || '#ffffff';
  const subtitleColor = proposal.cover_subtitle_color || branding.cover_subtitle_color || '#ffffffb3';
  const btnBg = proposal.cover_button_bg || branding.cover_button_bg || '#ff6700';
  const btnText = proposal.cover_button_text_color || branding.cover_button_text || '#ffffff';
  const overlayOpacity = proposal.cover_overlay_opacity ?? branding.cover_overlay_opacity ?? 0.65;
  const gradientType = proposal.cover_gradient_type || branding.cover_gradient_type || 'linear';
  const gradientAngle = proposal.cover_gradient_angle ?? branding.cover_gradient_angle ?? 135;

  // Visibility flags (default true for prepared_by for backward compat)
  const showPreparedBy = proposal.cover_show_prepared_by ?? true;
  const showDate = proposal.cover_show_date ?? false;
  const showClientLogo = proposal.cover_show_client_logo ?? false;
  const showAvatar = proposal.cover_show_avatar ?? false;

  // Use resolved name as fallback when proposal.prepared_by is not set
  const preparedByName = proposal.prepared_by || resolvedName;

  // Build background: solid or gradient (linear / radial / conic)
  const baseBg = bgStyle === 'solid'
    ? bgColor1
    : undefined;

  function buildGradient(color1: string, color2: string): string {
    switch (gradientType) {
      case 'radial':
        return `radial-gradient(circle, ${color1}, ${color2})`;
      case 'conic':
        return `conic-gradient(from ${gradientAngle}deg, ${color1}, ${color2})`;
      default:
        return `linear-gradient(${gradientAngle}deg, ${color1}, ${color2})`;
    }
  }

  const baseBgImage = bgStyle === 'gradient'
    ? buildGradient(bgColor1, bgColor2)
    : undefined;

  // Build overlay for when a cover image is present
  const overlayEnd = overlayOpacity + 0.1 > 1 ? 1 : overlayOpacity + 0.1;
  const imageOverlay = bgStyle === 'solid'
    ? hexToRgba(bgColor1, overlayOpacity)
    : buildGradient(
        hexToRgba(bgColor1, overlayOpacity),
        hexToRgba(bgColor2, overlayEnd)
      );

  // Has prepared-by meta row? Use resolved name as fallback
  const hasPreparedByRow = showPreparedBy && preparedByName;
  // Has date row?
  const hasDateRow = showDate && proposal.cover_date;

  return (
    <div
      className={`${hideButton ? 'w-full h-full' : 'h-screen w-screen'} flex flex-col justify-between relative overflow-hidden transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: bgColor1 }}
    >
      {/* Background: either uploaded image or the branding bg */}
      {bgUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: baseBg,
            backgroundImage: baseBgImage,
          }}
        />
      )}

      {/* Overlay — only needed when there's a background image */}
      {bgUrl && (
        <div
          className="absolute inset-0"
          style={{
            background: typeof imageOverlay === 'string' && imageOverlay.includes('-gradient(')
              ? imageOverlay
              : undefined,
            backgroundColor: typeof imageOverlay === 'string' && !imageOverlay.includes('-gradient(')
              ? imageOverlay
              : undefined,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full px-6 py-8 sm:px-10 sm:py-10 md:px-16 md:py-14">
        {/* Company logo / name */}
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="h-7 sm:h-8 md:h-10 max-w-[180px] object-contain"
            />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={18} style={{ color: subtitleColor }} />
              <span
                className="text-sm font-medium tracking-wide"
                style={{ color: textColor, opacity: 0.9, fontFamily: fontFamily(branding.font_heading) }}
              >
                {branding.name}
              </span>
            </div>
          ) : null}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Client logo (above title) */}
        {showClientLogo && clientLogoUrl && (
          <img
            src={clientLogoUrl}
            alt="Client"
            className="h-8 sm:h-9 md:h-10 max-w-[180px] object-contain mb-5 opacity-90"
          />
        )}

        {/* Title + meta + CTA */}
        <div className="max-w-2xl">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight mb-3"
            style={{ color: textColor, fontFamily: fontFamily(branding.font_heading), fontWeight: branding.font_heading_weight || undefined }}
          >
            {proposal.title}
          </h1>

          {/* Date (directly under title) */}
          {hasDateRow && (
            <p
              className="text-xs sm:text-sm mb-2"
              style={{ color: subtitleColor, opacity: 0.7, fontFamily: fontFamily(branding.font_body) }}
            >
              {proposal.cover_date}
            </p>
          )}

          <p
            className="text-sm sm:text-base md:text-lg mb-1"
            style={{ color: subtitleColor, fontFamily: fontFamily(branding.font_body), fontWeight: branding.font_body_weight || undefined }}
          >
            {subtitle}
          </p>

          {/* Prepared-by row with optional avatar */}
          {hasPreparedByRow && (
            <div className="flex items-center gap-2.5 mb-1">
              {showAvatar && avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={preparedByName || ''}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2"
                  style={{ borderColor: `${subtitleColor}40` }}
                />
              )}
              <p
                className="text-xs sm:text-sm"
                style={{ color: subtitleColor, opacity: 0.8, fontFamily: fontFamily(branding.font_body) }}
              >
                Prepared by {preparedByName}
              </p>
            </div>
          )}

          {/* CTA button — hidden in export mode */}
          {!hideButton && (
            <>
              {/* Spacing before button */}
              <div className={hasPreparedByRow || hasDateRow ? 'mt-5' : 'mt-6'} />

              <button
                onClick={onStart}
                className="px-8 py-3.5 text-sm font-semibold tracking-wider uppercase rounded-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                style={{
                  backgroundColor: btnBg,
                  color: btnText,
                  fontFamily: fontFamily(branding.font_heading),
                }}
              >
                {buttonText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}