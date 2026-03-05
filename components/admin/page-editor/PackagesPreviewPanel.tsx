// components/admin/page-editor/PackagesPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Package, ExternalLink } from 'lucide-react';
import { supabase, ProposalPackages } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PackagesPage from '@/components/viewer/PackagesPage';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

interface PackagesPreviewPanelProps {
  proposalId: string;
  packagesId?: string;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  companyId?: string;
}

export default function PackagesPreviewPanel({
  proposalId,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
  companyId: directCompanyId,
  packagesId,
}: PackagesPreviewPanelProps) {
  const [packages, setPackages] = useState<ProposalPackages | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch packages + branding
  useEffect(() => {
    const fetchData = async () => {
      try {
        const isTemplate = !!directCompanyId;
        const endpoint = isTemplate
          ? `/api/templates/packages?template_id=${proposalId}${packagesId ? `&packages_id=${packagesId}` : ''}`
          : `/api/proposals/packages?proposal_id=${proposalId}${packagesId ? `&packages_id=${packagesId}` : ''}`;

        const pkgRes = await fetch(endpoint);
        if (pkgRes.ok) {
          const data = await pkgRes.json();
          const rows: ProposalPackages[] = Array.isArray(data) ? data : (data ? [data] : []);
          const found = packagesId ? rows.find((p) => p.id === packagesId) ?? rows[0] : rows[0];
          if (found) setPackages(found);
        }

        // Fetch branding
        let companyIdToUse = directCompanyId;

        if (!companyIdToUse) {
          const { data: proposal } = await supabase
            .from('proposals')
            .select('company_id')
            .eq('id', proposalId)
            .single();
          companyIdToUse = proposal?.company_id;
        }

        if (companyIdToUse) {
          const { data: company } = await supabase
            .from('companies')
            .select('name, logo_url, accent_color, website, bg_primary, bg_secondary, sidebar_text_color, accept_text_color, cover_bg_style, cover_bg_color_1, cover_bg_color_2, cover_text_color, cover_subtitle_color, cover_button_bg, cover_button_text, cover_overlay_opacity, cover_gradient_type, cover_gradient_angle, font_heading, font_body, font_sidebar')
            .eq('id', companyIdToUse)
            .single();

          if (company) {
            setBranding({ ...DEFAULT_BRANDING, ...company });
          }
        }
      } catch {
        // silent
      }
      setLoading(false);
    };

    fetchData();
  }, [proposalId, directCompanyId, packagesId]);

  // Measure container and calculate scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        // PackagesPage renders at ~960px max-width + padding ~1020px
        const scale = Math.min(1, width / 1020);
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

  if (!packages) {
    return (
      <div ref={containerRef} className="flex-1 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Package size={20} className="text-gray-300" />
          <p className="text-xs text-gray-400">No packages data yet</p>
          <p className="text-[10px] text-gray-300">Add packages in the Packages tab</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
        {/* Header bar — matches PricingPreviewPanel / PdfPreviewPanel */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onGoPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-500 font-medium">Packages Page</span>
            <button
              onClick={onGoNext}
              disabled={!canGoNext}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
            <Package size={11} />
            {packages.title}
          </span>
        </div>

        {/* Scaled preview container */}
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
            <PackagesPage packages={packages} branding={branding} />
          </div>
        </div>

        {/* Footer hint */}
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <ExternalLink size={9} />
            Edit in the Packages tab
          </span>
        </div>
      </div>
    </div>
  );
}