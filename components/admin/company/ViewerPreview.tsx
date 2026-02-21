// components/admin/company/ViewerPreview.tsx
'use client';

import { Building2, CheckCircle2, MessageSquare, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { deriveBorder, deriveSurface } from '@/lib/company-utils';
import { fontFamily } from '@/lib/google-fonts';

interface ViewerPreviewProps {
  accent: string;
  bgPrimary: string;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
  sidebarTextColor: string;
  acceptTextColor: string;
  fontSidebar?: string | null;
}

export default function ViewerPreview({
  accent,
  bgPrimary,
  bgSecondary,
  logoUrl,
  companyName,
  sidebarTextColor,
  acceptTextColor,
  fontSidebar,
}: ViewerPreviewProps) {
  const border = deriveBorder(bgSecondary);
  const surface = deriveSurface(bgPrimary, bgSecondary);

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-2xl shadow-black/40"
      style={{ borderColor: border }}
    >
      <div className="flex h-[320px]" style={{ backgroundColor: bgPrimary }}>
        {/* Sidebar */}
        <div
          className="w-[160px] shrink-0 flex flex-col border-r"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
          <div className="px-3 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: border }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-4 max-w-[120px] object-contain" />
            ) : companyName ? (
              <div className="flex items-center gap-1.5">
                <Building2 size={12} className="text-[#555]" />
                <span className="text-[10px] text-white font-medium truncate">{companyName}</span>
              </div>
            ) : (
              <div className="w-16 h-3 rounded" style={{ backgroundColor: border }} />
            )}
          </div>
          <div className="flex-1 py-2 space-y-0.5 px-1" style={{ fontFamily: fontFamily(fontSidebar) }}>
            {['Executive Summary', 'Our Approach', 'Project Timeline', 'Investment', 'Case Studies', 'Next Steps'].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] truncate"
                style={{
                  color: i === 0 ? sidebarTextColor : `${sidebarTextColor}88`,
                  fontWeight: i === 0 ? 600 : 400,
                  backgroundColor: i === 0 ? `${accent}15` : 'transparent',
                }}
              >
                {i === 1 && <ChevronRight size={8} className="shrink-0 text-[#555]" />}
                {item}
              </div>
            ))}
          </div>
          <div className="p-2 space-y-1.5 border-t" style={{ borderColor: border }}>
            <div
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-semibold"
              style={{ backgroundColor: accent, color: acceptTextColor }}
            >
              <CheckCircle2 size={10} />
              Accept Proposal
            </div>
            <div
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-medium border"
              style={{
                backgroundColor: `${accent}15`,
                borderColor: `${accent}40`,
                color: accent,
              }}
            >
              <MessageSquare size={10} />
              Comments
              <span
                className="text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${accent}30`, color: accent }}
              >
                3
              </span>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[260px] space-y-3">
            <div
              className="rounded-lg p-4 border"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <div className="w-3/4 h-2.5 rounded mb-3" style={{ backgroundColor: border }} />
              <div className="w-full h-2 rounded mb-2" style={{ backgroundColor: `${border}80` }} />
              <div className="w-5/6 h-2 rounded mb-2" style={{ backgroundColor: `${border}80` }} />
              <div className="w-2/3 h-2 rounded mb-4" style={{ backgroundColor: `${border}80` }} />
              <div className="flex gap-2">
                <div className="w-12 h-6 rounded" style={{ backgroundColor: accent, opacity: 0.8 }} />
                <div className="w-12 h-6 rounded border" style={{ borderColor: border }} />
              </div>
            </div>
            <div
              className="rounded-lg h-16 border flex items-center justify-center"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <ImageIcon size={16} style={{ color: `${border}` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}