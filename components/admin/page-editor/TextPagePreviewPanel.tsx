// components/admin/page-editor/TextPagePreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileText, Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TextPage from '@/components/viewer/TextPage';
import { TextPageData } from './useTextPagesState';
import TextPageEditorModal from './TextPageEditorModal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

interface TextPagePreviewPanelProps {
  proposalId: string;
  page: TextPageData;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (pageId: string, changes: Partial<TextPageData>) => void;
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

  // Fetch branding + proposal info for preview context
  useEffect(() => {
    const fetchData = async () => {
      try {
        // If companyId is provided directly (e.g. from templates), skip proposals lookup
        if (companyIdProp) {
          setResolvedCompanyId(companyIdProp);
          const res = await fetch(`/api/company/branding?company_id=${companyIdProp}`);
          if (res.ok) {
            const data = await res.json();
            setBranding({ ...DEFAULT_BRANDING, ...data });
          }
          return;
        }

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
  }, [proposalId, companyIdProp]);

  // Measure container and calculate scale
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 2;
        // TextPage renders at ~700px max-width + padding ≈ ~780px
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
              {/* Save status */}
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
              {/* Edit button */}
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#017C87] hover:bg-[#015F68] transition-colors"
              >
                <Pencil size={12} />
                Edit
              </button>
              <span className="text-xs text-[#017C87] font-medium flex items-center gap-1">
                <FileText size={11} />
                {page.title || 'Text Page'}
              </span>
            </div>
          </div>

          {/* Scaled preview */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                width: `${100 / previewScale}%`,
              }}
            >
              <TextPage
                textPage={{
                  id: page.id,
                  proposal_id: proposalId,
                  company_id: '',
                  title: page.title,
                  content: page.content,
                  position: page.position,
                  enabled: page.enabled,
                  sort_order: page.sort_order,
                  indent: 0,
                  show_member_badge: page.show_member_badge,
                  prepared_by_member_id: page.prepared_by_member_id,
                  show_title: page.show_title,
                }}
                branding={branding}
                clientName={proposal?.client_name}
                companyName={branding.name || undefined}
                proposalTitle={proposal?.title}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor modal */}
      {showEditor && (
        <TextPageEditorModal
          page={page}
          saveStatus={saveStatus}
          onUpdate={onUpdate}
          onClose={() => setShowEditor(false)}
          companyId={resolvedCompanyId}
        />
      )}
    </>
  );
}