// components/admin/page-editor/TextPagePreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileText, Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TextPage from '@/components/viewer/TextPage';
import { TextPageData } from './pageEditorTypes';
import TextPageEditorModal from './TextPageEditorModal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { UnifiedPage } from '@/lib/page-operations';

interface TextPagePreviewPanelProps {
  proposalId: string;
  page: UnifiedPage;
  saveStatus: 'idle' | 'saving' | 'saved';
  /** Mapped through handleTextPageUpdate in PageEditor — receives (pageId, Record<string,unknown>) */
  onUpdate: (pageId: string, changes: Record<string, unknown>) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  /** When provided, fetches branding directly instead of looking up via proposals table */
  companyId?: string;
}

/**
 * Build a TextPageData-compatible object from a UnifiedPage so the existing
 * TextPageEditorModal can consume it without modification.
 */
function toTextPageData(page: UnifiedPage): TextPageData {
  const payload = (page.payload ?? {}) as Record<string, unknown>;
  return {
    id:                    page.id,
    title:                 page.title,
    content:               payload.content ?? null,
    show_title:            page.show_title,
    show_member_badge:     page.show_member_badge,
    prepared_by_member_id: page.prepared_by_member_id ?? null,
  };
}

export default function TextPagePreviewPanel({
  proposalId,
  page,
  saveStatus,
  onUpdate,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
  companyId: companyIdProp,
}: TextPagePreviewPanelProps) {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [proposal, setProposal] = useState<{ client_name?: string; title?: string } | null>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [showEditor, setShowEditor] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | undefined>(companyIdProp);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve company_id — prefer page.company_id when available (avoids extra DB call)
  useEffect(() => {
    const effectiveCompanyId = companyIdProp ?? page.company_id ?? undefined;

    const fetchData = async () => {
      try {
        if (effectiveCompanyId) {
          setResolvedCompanyId(effectiveCompanyId);
          const res = await fetch(`/api/company/branding?company_id=${effectiveCompanyId}`);
          if (res.ok) {
            const data = await res.json();
            setBranding({ ...DEFAULT_BRANDING, ...data });
          }
          return;
        }

        // Fallback: look up company_id via proposals table
        const { data: prop } = await supabase
          .from('proposals')
          .select('company_id, client_name, title')
          .eq('id', proposalId)
          .single();

        if (prop) {
          setProposal({ client_name: prop.client_name, title: prop.title });
          setResolvedCompanyId(prop.company_id);

          if (prop.company_id) {
            const res = await fetch(`/api/company/branding?company_id=${prop.company_id}`);
            if (res.ok) {
              const data = await res.json();
              setBranding({ ...DEFAULT_BRANDING, ...data });
            }
          }
        }
      } catch {
        // Use defaults
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, companyIdProp, page.company_id]);

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
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, []);

  const textPageData = toTextPageData(page);
  const payload = (page.payload ?? {}) as Record<string, unknown>;

  return (
    <>
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
              <span className="text-xs text-gray-500 font-medium">Text Page</span>
              <button
                onClick={onGoNext}
                disabled={!canGoNext}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:text-gray-200 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Loader2 size={10} className="animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[10px] text-green-500">
                  <Check size={10} />
                  Saved
                </span>
              )}
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#017C87] hover:bg-[#015F68] transition-colors"
              >
                <Pencil size={12} />
                Edit
              </button>
              <span className="text-xs text-[#017C87] font-medium flex items-center gap-1 ml-1">
                <FileText size={11} />
                {page.title || 'Text Page'}
              </span>
            </div>
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
                }}
                branding={branding}
                clientName={proposal?.client_name}
                companyName={branding.name || undefined}
                proposalTitle={proposal?.title}
              />
            </div>
          </div>

          {/* Footer hint */}
          <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Pencil size={9} />
              Click Edit to update content
            </span>
          </div>
        </div>
      </div>

      {/* Editor modal — still takes TextPageData; we pass the derived object */}
      {showEditor && (
        <TextPageEditorModal
          page={textPageData}
          saveStatus={saveStatus}
          onUpdate={(pageId, changes) => onUpdate(pageId, changes as Record<string, unknown>)}
          onClose={() => setShowEditor(false)}
          companyId={resolvedCompanyId}
        />
      )}
    </>
  );
}