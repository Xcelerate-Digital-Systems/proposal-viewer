// components/admin/proposals/quote-builder/LoadTemplateBar.tsx
// Pinned bar at the top of the Quote Builder. Lets the user load a saved
// quote template into the current quote — applies cover styling, design
// (fonts/colours), title, scope, and quote_extras (about/testimonial/terms).
// Line items are intentionally NOT touched here — that flow lives on the
// Line Item Library buttons in the pricing section so the two concerns
// stay independent.

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Files, AlertTriangle } from 'lucide-react';
import { supabase, type Proposal, type ProposalTemplate } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface LoadTemplateBarProps {
  proposal: Proposal;
  companyId: string;
  onApplied: () => void;
}

/* Fields copied from template → quote when the user applies one. Line items
   live in a separate table and aren't touched. */
const TEMPLATE_FIELDS: Array<keyof ProposalTemplate> = [
  'cover_image_path',
  'cover_subtitle',
  'cover_button_text',
  'cover_bg_style',
  'cover_bg_color_1',
  'cover_bg_color_2',
  'cover_gradient_type',
  'cover_gradient_angle',
  'cover_overlay_opacity',
  'cover_text_color',
  'cover_subtitle_color',
  'cover_button_bg',
  'cover_button_text_color',
  'text_page_bg_color',
  'text_page_text_color',
  'text_page_heading_color',
  'text_page_font_size',
  'title_font_family',
  'title_font_weight',
  'title_font_size',
  'page_num_circle_color',
  'page_num_text_color',
  'bg_image_path',
  'bg_image_overlay_opacity',
];

export default function LoadTemplateBar({
  proposal,
  companyId,
  onApplied,
}: LoadTemplateBarProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates.length > 0 || loading) return;
    setLoading(true);
    supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'quote')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates(data ?? []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const apply = async (template: ProposalTemplate) => {
    const ok = await confirm({
      title: `Apply "${template.name}"?`,
      message:
        'This will overwrite the cover, design (fonts/colours), and any text-page background settings on this quote. Line items are not affected.',
      confirmLabel: 'Apply Template',
      destructive: false,
    });
    if (!ok) return;

    setApplyingId(template.id);
    try {
      const updates: Record<string, unknown> = {};
      for (const key of TEMPLATE_FIELDS) {
        const v = template[key];
        if (v !== undefined && v !== null) {
          updates[key as string] = v;
        }
      }

      const { error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', proposal.id);

      if (error) throw error;
      toast.success(`Template "${template.name}" applied`);
      setOpen(false);
      onApplied();
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply template');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-prose bg-white border border-edge-strong hover:border-edge-hover transition-colors"
      >
        <Files size={14} className="text-faint" />
        Load Template
        <ChevronDown size={12} className="text-faint" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-80 bg-white rounded-lg border border-edge-strong shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-6 text-center text-xs text-faint">
              <Loader2 size={14} className="inline animate-spin" /> Loading…
            </div>
          ) : templates.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint leading-relaxed">
              No quote templates yet. Save a quote as a template from the Templates page.
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-edge bg-amber-50/40">
                <div className="flex items-start gap-1.5 text-detail text-amber-700">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span>
                    Applying a template overwrites cover &amp; design. Line items stay as they are.
                  </span>
                </div>
              </div>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => apply(t)}
                  disabled={applyingId === t.id}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-ink truncate">{t.name}</div>
                  {t.description && (
                    <div className="text-xs text-faint truncate mt-0.5">{t.description}</div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
