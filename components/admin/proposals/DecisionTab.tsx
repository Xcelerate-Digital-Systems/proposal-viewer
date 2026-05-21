// components/admin/proposals/DecisionTab.tsx
// Editor for the synthetic Decision page: enable toggle + title (via the
// shared DecisionPageCard) + Next Steps editor + Terms editor. Mirrors the
// quote builder's NextStepsSection / TermsSection but writes to
// proposals.decision_extras instead of quote_extras.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListOrdered, FileText, Plus, X, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import DecisionPageCard from '@/components/admin/proposals/DecisionPageCard';
import DecisionPagePreview from '@/components/admin/builder-sections/DecisionPagePreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import {
  parseDecisionExtras,
  DEFAULT_DECISION_NEXT_STEPS,
  DEFAULT_DECISION_TERMS,
  type DecisionExtras,
} from '@/lib/types/decision-extras';

interface DecisionTabProps {
  entityId: string;
  /** Defaults to 'proposals'. Templates write to 'proposal_templates'. */
  table?: 'proposals' | 'proposal_templates';
  initialEnabled: boolean | null;
  initialTitle: string | null;
  initialExtras: unknown;
  onSaved?: () => void;
}

const DEFAULT_DISPLAY_TITLE = 'Decision';

export default function DecisionTab({
  entityId,
  table = 'proposals',
  initialEnabled,
  initialTitle,
  initialExtras,
  onSaved,
}: DecisionTabProps) {
  const toast = useToast();
  const parsed = parseDecisionExtras(initialExtras);
  const [steps, setSteps] = useState<string[]>(parsed.next_steps);
  const [terms, setTerms] = useState<string>(parsed.terms);
  // Mirror the DecisionPageCard's title locally so the preview shows the
  // live value while the user is typing (the card owns the debounced save).
  const [previewTitle, setPreviewTitle] = useState<string>(initialTitle ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useReportSaveStatus(saveStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: DecisionExtras) => {
      setSaveStatus('saving');
      try {
        const { error } = await supabase
          .from(table)
          .update({ decision_extras: next })
          .eq('id', entityId);
        if (error) throw error;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        onSaved?.();
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save Decision page content');
      }
    },
    [entityId, table, toast, onSaved],
  );

  const schedule = useCallback(
    (next: DecisionExtras) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persist(next), 600);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setStepsAndSave = (next: string[]) => {
    setSteps(next);
    schedule({ next_steps: next.map((s) => s.trim()).filter(Boolean).slice(0, 4), terms });
  };

  const setTermsAndSave = (next: string) => {
    setTerms(next);
    schedule({ next_steps: steps.map((s) => s.trim()).filter(Boolean).slice(0, 4), terms: next });
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6 max-w-2xl">
      {/* Enable toggle + title — same card the user already knows from Pages tab. */}
      <DecisionPageCard
        entityId={entityId}
        table={table}
        initialEnabled={initialEnabled}
        initialTitle={initialTitle}
        onSaved={onSaved}
        onTitleLive={setPreviewTitle}
      />

      {/* Next Steps editor */}
      <SectionCard
        title="Next Steps"
        icon={<ListOrdered size={14} className="text-gray-400" />}
        description="Numbered list shown above the accept form. Up to four steps."
        action={
          <button
            type="button"
            onClick={() => setStepsAndSave([...DEFAULT_DECISION_NEXT_STEPS])}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 w-6 shrink-0 tabular-nums">
                0{i + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={(e) =>
                  setStepsAndSave(steps.map((s, idx) => (idx === i ? e.target.value : s)))
                }
                placeholder={DEFAULT_DECISION_NEXT_STEPS[i] ?? 'Add a step…'}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
              <button
                type="button"
                onClick={() => setStepsAndSave(steps.filter((_, idx) => idx !== i))}
                disabled={steps.length <= 1}
                className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                title="Remove step"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        {steps.length < 4 && (
          <button
            type="button"
            onClick={() => setStepsAndSave([...steps, ''])}
            className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
          >
            <Plus size={12} />
            Add step
          </button>
        )}
      </SectionCard>

      {/* Terms editor */}
      <SectionCard
        title="Terms & Conditions"
        icon={<FileText size={14} className="text-gray-400" />}
        description="Plain text shown beneath the Next Steps. Use line breaks for paragraphs."
        action={
          <button
            type="button"
            onClick={() => setTermsAndSave(DEFAULT_DECISION_TERMS)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <textarea
          value={terms}
          onChange={(e) => setTermsAndSave(e.target.value)}
          rows={6}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
        />
      </SectionCard>
      </div>

      <StickyPreviewAside>
        <DecisionPagePreview
          entityId={entityId}
          entityKey={table === 'proposal_templates' ? 'template_id' : 'proposal_id'}
          title={previewTitle || DEFAULT_DISPLAY_TITLE}
          steps={steps}
          terms={terms}
        />
      </StickyPreviewAside>
    </div>
  );
}
