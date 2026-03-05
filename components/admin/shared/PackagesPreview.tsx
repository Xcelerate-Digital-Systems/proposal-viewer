// components/admin/shared/PackagesPreview.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { ProposalPackages } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PackagesPage from '@/components/viewer/PackagesPage';

interface PackagesPreviewProps {
  packages: ProposalPackages;
  branding: CompanyBranding;
}

export default function PackagesPreview({ packages, branding }: PackagesPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.4);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        setPreviewScale(Math.min(0.55, width / 1020));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  const hasPackages = (packages.packages ?? []).length > 0;

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-0 sticky top-0 self-start"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
        {/* Header bar */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Live Preview</span>
          <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
            <Package size={11} /> {packages.title}
          </span>
        </div>

        {/* Scaled scrollable content */}
        <div className="flex-1 min-h-[400px] overflow-hidden relative">
          <div
            className="absolute inset-0 overflow-y-auto"
            style={{
              transformOrigin: 'top left',
              transform: `scale(${previewScale})`,
              width: `${100 / previewScale}%`,
              height: `${100 / previewScale}%`,
            }}
          >
            {hasPackages ? (
              <PackagesPage packages={packages} branding={branding} />
            ) : (
              <div
                className="w-full min-h-full flex items-center justify-center"
                style={{ backgroundColor: branding.bg_primary || '#0f0f0f' }}
              >
                <div className="text-center">
                  <Package size={32} className="mx-auto mb-3" style={{ color: `${branding.sidebar_text_color || '#ffffff'}55` }} />
                  <p className="text-sm" style={{ color: `${branding.sidebar_text_color || '#ffffff'}88` }}>Add packages to see a preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-400">
            {(packages.packages ?? []).length} package{(packages.packages ?? []).length !== 1 ? 's' : ''} · Scales to fit
          </span>
        </div>
      </div>
    </div>
  );
}