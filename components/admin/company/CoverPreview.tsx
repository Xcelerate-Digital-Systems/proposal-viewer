// components/admin/company/CoverPreview.tsx
'use client';

import { Building2 } from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';

interface CoverPreviewProps {
  bgStyle: 'gradient' | 'solid';
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  subtitleColor: string;
  buttonBg: string;
  buttonText: string;
  overlayOpacity: number;
  gradientType: 'linear' | 'radial' | 'conic';
  gradientAngle: number;
  logoUrl: string | null;
  companyName: string;
  fontHeading?: string | null;
  fontBody?: string | null;
  fontHeadingWeight?: string | null;
  fontBodyWeight?: string | null;
}

function buildGradient(
  gradientType: 'linear' | 'radial' | 'conic',
  gradientAngle: number,
  c1: string,
  c2: string,
): string {
  switch (gradientType) {
    case 'radial':
      return `radial-gradient(circle, ${c1}, ${c2})`;
    case 'conic':
      return `conic-gradient(from ${gradientAngle}deg, ${c1}, ${c2})`;
    default:
      return `linear-gradient(${gradientAngle}deg, ${c1}, ${c2})`;
  }
}

export default function CoverPreview({
  bgStyle,
  bgColor1,
  bgColor2,
  textColor,
  subtitleColor,
  buttonBg,
  buttonText,
  overlayOpacity,
  gradientType,
  gradientAngle,
  logoUrl,
  companyName,
  fontHeading,
  fontBody,
  fontHeadingWeight,
  fontBodyWeight,
}: CoverPreviewProps) {
  const baseBg = bgStyle === 'solid' ? bgColor1 : undefined;
  const baseBgImage = bgStyle === 'gradient'
    ? buildGradient(gradientType, gradientAngle, bgColor1, bgColor2)
    : undefined;

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 shadow-2xl shadow-black/40 relative"
      style={{ backgroundColor: bgColor1 }}
    >
      <div className="relative h-[280px]">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: baseBg, backgroundImage: baseBgImage }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-5">
          {/* Logo */}
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-4 max-w-[100px] object-contain" />
            ) : companyName ? (
              <div className="flex items-center gap-1.5">
                <Building2 size={12} style={{ color: subtitleColor }} />
                <span className="text-[10px] font-medium" style={{ color: textColor, opacity: 0.9 }}>{companyName}</span>
              </div>
            ) : (
              <div className="w-14 h-3 rounded bg-white/20" />
            )}
          </div>

          {/* Title area */}
          <div>
            <h3
              className="text-base font-semibold leading-tight mb-1"
              style={{ color: textColor, fontFamily: fontFamily(fontHeading), fontWeight: fontHeadingWeight ? Number(fontHeadingWeight) : undefined }}
            >
              Project Proposal
            </h3>
            <p
              className="text-[11px] mb-3"
              style={{ color: subtitleColor, fontFamily: fontFamily(fontBody), fontWeight: fontBodyWeight ? Number(fontBodyWeight) : undefined }}
            >
              Prepared for Client Name
            </p>
            <div
              className="inline-block px-3 py-1.5 text-[9px] font-semibold tracking-wider uppercase rounded-sm"
              style={{ backgroundColor: buttonBg, color: buttonText, fontFamily: fontFamily(fontBody), fontWeight: fontBodyWeight ? Number(fontBodyWeight) : undefined }}
            >
              START READING
            </div>
          </div>

          <div />
        </div>

        {/* Overlay opacity indicator */}
        <div className="absolute bottom-2 right-2 z-20">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-white/60">
            overlay: {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}