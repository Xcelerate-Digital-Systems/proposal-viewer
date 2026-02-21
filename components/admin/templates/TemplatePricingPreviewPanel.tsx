// components/admin/templates/TemplatePricingPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, ExternalLink } from 'lucide-react';
import {
  supabase, TemplatePricing, DEFAULT_PAYMENT_SCHEDULE,
  normalizePaymentSchedule, ProposalPricing,
} from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PricingPage from '@/components/viewer/PricingPage';

interface TemplatePricingPreviewPanelProps {
  templateId: string;
  companyId: string;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

const DEFAULT_BRANDING: CompanyBranding = {
  name: '',
  logo_url: null,
  accent_color: '#ff6700',
  website: null,
  bg_primary: '#0f0f0f',
  bg_secondary: '#141414',
  sidebar_text_color: '#ffffff',
  accept_text_color: '#ffffff',
  cover_bg_style: 'gradient',
  cover_bg_color_1: '#0f0f0f',
  cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff',
  cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700',
  cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65,
  cover_gradient_type: 'linear',
  cover_gradient_angle: 135,
  font_heading: null,
  font_body: null,
  font_sidebar: null,
  font_heading_weight: null,
  font_body_weight: null,
  font_sidebar_weight: null,
};

export default function TemplatePricingPreviewPanel({
  templateId,
  companyId,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: TemplatePricingPreviewPanelProps) {
  const [pricing, setPricing] = useState<ProposalPricing | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch pricing + branding
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch template pricing
        const pricingRes = await fetch(`/api/templates/pricing?template_id=${templateId}`);
        if (pricingRes.ok) {
          const data: TemplatePricing | null = await pricingRes.json();
          if (data) {
            // Convert TemplatePricing → ProposalPricing shape for PricingPage
            setPricing({
              ...data,
              proposal_id: templateId,
              proposal_date: new Date().toISOString().split('T')[0],
              payment_schedule: data.payment_schedule
                ? normalizePaymentSchedule(data.payment_schedule)
                : null,
            } as ProposalPricing);
          }
        }

        // Fetch company branding
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url, accent_color, website, bg_primary, bg_secondary, sidebar_text_color, accept_text_color, cover_bg_style, cover_bg_color_1, cover_bg_color_2, cover_text_color, cover_subtitle_color, cover_button_bg, cover_button_text, cover_overlay_opacity, cover_gradient_type, cover_gradient_angle, font_heading, font_body, font_sidebar')
          .eq('id', companyId)
          .single();

        if (company) {
          setBranding({ ...DEFAULT_BRANDING, ...company });
        }
      } catch {
        // silent
      }
      setLoading(false);
    };

    fetchData();
  }, [templateId, companyId]);

  // Measure container and calculate scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        const scale = Math.min(1, width / 780);
        setPreviewScale(scale);
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  if (loading) {
    return (
      <div ref={containerRef} className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!pricing) {
    return (
      <div ref={containerRef} className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <DollarSign size={20} className="text-gray-300" />
          <p className="text-xs text-gray-400">No pricing data yet</p>
          <p className="text-[10px] text-gray-300">Add line items in the Pricing tab</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
        {/* Header bar */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onGoPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-500 font-medium">Pricing Page</span>
            <button
              onClick={onGoNext}
              disabled={!canGoNext}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
            <DollarSign size={11} />
            {pricing.title}
          </span>
        </div>

        {/* Scaled preview */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
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

        {/* Footer hint */}
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <ExternalLink size={9} />
            Edit in the Pricing tab
          </span>
        </div>
      </div>
    </div>
  );
}