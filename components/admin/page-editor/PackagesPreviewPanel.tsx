// components/admin/page-editor/PackagesPreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Package, ExternalLink } from 'lucide-react';
import { ProposalPackages, normalizePackageStyling } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PackagesPage from '@/components/viewer/PackagesPage';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { UnifiedPage } from '@/lib/page-operations';

interface PackagesPreviewPanelProps {
  proposalId: string;
  /** Packages page row — already loaded by usePageEditor in the parent */
  page: UnifiedPage;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

/** Reconstruct a ProposalPackages object from a unified page row. */
function toPackagesData(page: UnifiedPage): ProposalPackages {
  const payload = (page.payload ?? {}) as Record<string, unknown>;
  return {
    id:           page.id,
    proposal_id:  page.entity_id,
    company_id:   page.company_id,
    enabled:      page.enabled,
    position:     page.position,
    indent:       page.indent ?? 0,
    sort_order:   0,
    title:        page.title,
    intro_text:   (payload.intro_text  as string)  ?? null,
    packages:     (payload.packages    as ProposalPackages['packages']) ?? [],
    footer_text:  (payload.footer_text as string)  ?? null,
    styling:      normalizePackageStyling(payload.styling),
    created_at:   page.created_at,
    updated_at:   page.updated_at,
  };
}

export default function PackagesPreviewPanel({
  proposalId,
  page,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: PackagesPreviewPanelProps) {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [previewScale, setPreviewScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch branding using company_id already present on the page row
  useEffect(() => {
    if (!page.company_id) return;
    fetch(`/api/company/branding?company_id=${page.company_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBranding({ ...DEFAULT_BRANDING, ...data }); })
      .catch(() => {});
  }, [page.company_id]);

  // Measure container and calculate scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        const scale = Math.min(1, width / 1020);
        setPreviewScale(scale);
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  const packages = toPackagesData(page);

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
            <span className="text-xs text-gray-500 font-medium">Packages Page</span>
            <button
              onClick={onGoNext}
              disabled={!canGoNext}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="text-xs text-teal font-medium flex items-center gap-1">
            <Package size={11} />
            {packages.title}
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