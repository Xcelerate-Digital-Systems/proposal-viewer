// components/admin/shared/PricingPreview.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { ProposalPricing } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PricingPage from '@/components/viewer/PricingPage';

interface PricingPreviewProps {
  pricing: ProposalPricing;
  branding: CompanyBranding;
}

export default function PricingPreview({ pricing, branding }: PricingPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        setPreviewScale(Math.min(1, width / 780));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full min-h-0"
    >
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
        {/* Header bar */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Live Preview</span>
          <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
            <DollarSign size={11} /> {pricing.title}
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
            <PricingPage pricing={pricing} branding={branding} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-400">
            {pricing.items.length} item{pricing.items.length !== 1 ? 's' : ''} · Scales to fit
          </span>
        </div>
      </div>
    </div>
  );
}