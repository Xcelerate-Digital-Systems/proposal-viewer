// components/admin/page-editor/TextPagePreviewPanel.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileText, Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import TextPage from '@/components/viewer/TextPage';
import { TextPageData } from './useTextPagesState';
import TextPageEditorModal from './TextPageEditorModal';

interface TextPagePreviewPanelProps {
  proposalId: string;
  page: TextPageData;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (pageId: string, changes: Partial<TextPageData>) => void;
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
  text_page_bg_color: '#141414',
  text_page_text_color: '#ffffff',
  text_page_heading_color: null,
  text_page_font_size: '14',
  text_page_border_enabled: true,
  text_page_border_color: null,
  text_page_border_radius: '12',
};

export default function TextPagePreviewPanel({
  proposalId,
  page,
  saveStatus,
  onUpdate,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: TextPagePreviewPanelProps) {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [proposal, setProposal] = useState<{ client_name?: string; title?: string } | null>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [showEditor, setShowEditor] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch branding + proposal info for preview context
  // Fetch branding + proposal info for preview context
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: prop } = await supabase
          .from('proposals')
          .select('company_id, client_name, title')
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
        }
      } catch {
        // Use defaults
      }
    };

    fetchData();
  }, [proposalId]);

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
              <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
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
        />
      )}
    </>
  );
}