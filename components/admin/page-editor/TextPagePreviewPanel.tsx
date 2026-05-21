// components/admin/page-editor/TextPagePreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TextPage from '@/components/viewer/TextPage';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { UnifiedPage } from '@/lib/page-operations';

interface TextPagePreviewPanelProps {
  proposalId: string;
  page: UnifiedPage;
  /** Kept for API compatibility — no longer used */
  saveStatus?: 'idle' | 'saving' | 'saved';
  /** Kept for API compatibility — no longer used */
  onUpdate?: (pageId: string, changes: Record<string, unknown>) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** When provided, fetches branding directly instead of looking up via proposals table */
  companyId?: string;
}

export default function TextPagePreviewPanel({
  proposalId,
  page,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
  companyId: companyIdProp,
}: TextPagePreviewPanelProps) {
  const [branding, setBranding]     = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [proposal, setProposal]     = useState<{ client_name?: string; title?: string } | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Fetch branding + proposal context ───────────────────────── */

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (companyIdProp) {
          const res = await fetch(`/api/company/branding?company_id=${companyIdProp}`);
          if (res.ok) {
            const data = await res.json();
            setBranding({ ...DEFAULT_BRANDING, ...data });
          }
          return;
        }

        const { data: prop } = await supabase
          .from('proposals')
          .select('company_id, client_name, title, cover_client_logo_path')
          .eq('id', proposalId)
          .single();

        if (prop) {
          setProposal({ client_name: prop.client_name, title: prop.title });
          if (prop.company_id) {
            const res = await fetch(`/api/company/branding?company_id=${prop.company_id}`);
            if (res.ok) {
              const data = await res.json();
              setBranding({ ...DEFAULT_BRANDING, ...data });
            }
          }
          if (prop.cover_client_logo_path) {
            const { data: logoData } = supabase.storage
              .from('proposals')
              .getPublicUrl(prop.cover_client_logo_path);
            if (logoData?.publicUrl) setClientLogoUrl(logoData.publicUrl);
          }
        }
      } catch {
        // Use defaults
      }
    };
    fetchData();
  }, [proposalId, companyIdProp]);

  /* ── Measure container for scale ────────────────────────────── */

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
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, []);

  /* ── Render ──────────────────────────────────────────────────── */

  const payload = (page.payload ?? {}) as Record<string, unknown>;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">
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
            <TextPage
              textPage={{
                id:                    page.id,
                proposal_id:           proposalId,
                company_id:            page.company_id ?? '',
                title:                 page.title,
                content:               payload.content ?? null,
                position:              page.position,
                enabled:               page.enabled,
                sort_order:            page.position,
                indent:                0,
                show_member_badge:     page.show_member_badge,
                prepared_by_member_id: page.prepared_by_member_id ?? null,
                show_title:            page.show_title,
                show_client_logo:      page.show_client_logo ?? false,
              }}
              branding={branding}
              clientName={proposal?.client_name}
              companyName={branding.name || undefined}
              proposalTitle={proposal?.title}
              clientLogoUrl={clientLogoUrl ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}