// components/admin/page-editor/PackagesPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
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
        // Fetch packages — use proposal endpoint for proposals, template for templates
        const isTemplate = !!directCompanyId;
        const endpoint = isTemplate
          ? `/api/templates/packages?template_id=${proposalId}${packagesId ? `&packages_id=${packagesId}` : ''}`
          : `/api/proposals/packages?proposal_id=${proposalId}${packagesId ? `&packages_id=${packagesId}` : ''}`;

        const pkgRes = await fetch(endpoint);
        if (pkgRes.ok) {
          const data = await pkgRes.json();
          if (data) {
            setPackages(data);
          }
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
  }, [proposalId, directCompanyId]);

  // Measure container and calculate scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        // PackagesPage renders at ~960px max-width + padding ≈ ~1020px
        const scale = Math.min(1, width / 1020);
        setPreviewScale(scale);
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onGoPrev} disabled={!canGoPrev} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button onClick={onGoNext} disabled={!canGoNext} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#017C87] font-medium">
          <Package size={13} />
          Packages Preview
        </div>
        <div className="w-16" /> {/* spacer */}
      </div>

      {/* Preview area */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-900 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          </div>
        ) : !packages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package size={24} className="mx-auto text-gray-500 mb-2" />
              <p className="text-sm text-gray-400">No packages data yet</p>
              <p className="text-xs text-gray-500 mt-1">Configure packages in the Packages tab</p>
            </div>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              width: `${100 / previewScale}%`,
            }}
          >
            <PackagesPage
              packages={packages}
              branding={branding}
            />
          </div>
        )}
      </div>
    </div>
  );
}