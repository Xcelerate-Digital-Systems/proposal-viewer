// components/admin/proposals/DecisionTab.tsx
// Editor for the synthetic Decision page: enable toggle + title (via the
// shared DecisionPageCard) + Next Steps editor + Terms editor. Mirrors the
// quote builder's NextStepsSection / TermsSection but writes to
// proposals.decision_extras instead of quote_extras.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListOrdered, FileText, Plus, X, RotateCcw, MessageSquare } from 'lucide-react';
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
  DEFAULT_DECISION_ACCEPT_HEADING,
  DEFAULT_DECISION_ACCEPT_SUBTITLE,
  DEFAULT_DECISION_AGREEMENT_TEXT,
  DEFAULT_DECISION_ACCEPT_BUTTON_LABEL,
  DEFAULT_DECISION_DECLINE_BUTTON_LABEL,
  DEFAULT_DECISION_REVISION_BUTTON_LABEL,
  DEFAULT_DECISION_DECLINE_HEADING,
  DEFAULT_DECISION_DECLINE_SUBTITLE,
  DEFAULT_DECISION_REVISION_HEADING,
  DEFAULT_DECISION_REVISION_SUBTITLE,
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
  const [acceptHeading, setAcceptHeading] = useState<string>(parsed.accept_heading);
  const [acceptSubtitle, setAcceptSubtitle] = useState<string>(parsed.accept_subtitle);
  const [agreementText, setAgreementText] = useState<string>(parsed.agreement_text);
  const [acceptButtonLabel, setAcceptButtonLabel] = useState<string>(parsed.accept_button_label);
  const [declineButtonLabel, setDeclineButtonLabel] = useState<string>(parsed.decline_button_label);
  const [revisionButtonLabel, setRevisionButtonLabel] = useState<string>(parsed.revision_button_label);
  const [declineHeading, setDeclineHeading] = useState<string>(parsed.decline_heading);
  const [declineSubtitle, setDeclineSubtitle] = useState<string>(parsed.decline_subtitle);
  const [revisionHeading, setRevisionHeading] = useState<string>(parsed.revision_heading);
  const [revisionSubtitle, setRevisionSubtitle] = useState<string>(parsed.revision_subtitle);
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

  const buildExtras = (overrides: Partial<DecisionExtras>): DecisionExtras => ({
    next_steps: (overrides.next_steps ?? steps).map((s) => s.trim()).filter(Boolean).slice(0, 4),
    terms: overrides.terms ?? terms,
    accept_heading: overrides.accept_heading ?? acceptHeading,
    accept_subtitle: overrides.accept_subtitle ?? acceptSubtitle,
    agreement_text: overrides.agreement_text ?? agreementText,
    accept_button_label: overrides.accept_button_label ?? acceptButtonLabel,
    decline_button_label: overrides.decline_button_label ?? declineButtonLabel,
    revision_button_label: overrides.revision_button_label ?? revisionButtonLabel,
    decline_heading: overrides.decline_heading ?? declineHeading,
    decline_subtitle: overrides.decline_subtitle ?? declineSubtitle,
    revision_heading: overrides.revision_heading ?? revisionHeading,
    revision_subtitle: overrides.revision_subtitle ?? revisionSubtitle,
  });

  const setStepsAndSave = (next: string[]) => {
    setSteps(next);
    schedule(buildExtras({ next_steps: next }));
  };

  const setTermsAndSave = (next: string) => {
    setTerms(next);
    schedule(buildExtras({ terms: next }));
  };

  const setAcceptHeadingAndSave = (next: string) => {
    setAcceptHeading(next);
    schedule(buildExtras({ accept_heading: next }));
  };

  const setAcceptSubtitleAndSave = (next: string) => {
    setAcceptSubtitle(next);
    schedule(buildExtras({ accept_subtitle: next }));
  };

  const setAgreementTextAndSave = (next: string) => {
    setAgreementText(next);
    schedule(buildExtras({ agreement_text: next }));
  };

  const setAcceptButtonLabelAndSave = (next: string) => {
    setAcceptButtonLabel(next);
    schedule(buildExtras({ accept_button_label: next }));
  };

  const setDeclineButtonLabelAndSave = (next: string) => {
    setDeclineButtonLabel(next);
    schedule(buildExtras({ decline_button_label: next }));
  };

  const setRevisionButtonLabelAndSave = (next: string) => {
    setRevisionButtonLabel(next);
    schedule(buildExtras({ revision_button_label: next }));
  };

  const setDeclineHeadingAndSave = (next: string) => {
    setDeclineHeading(next);
    schedule(buildExtras({ decline_heading: next }));
  };

  const setDeclineSubtitleAndSave = (next: string) => {
    setDeclineSubtitle(next);
    schedule(buildExtras({ decline_subtitle: next }));
  };

  const setRevisionHeadingAndSave = (next: string) => {
    setRevisionHeading(next);
    schedule(buildExtras({ revision_heading: next }));
  };

  const setRevisionSubtitleAndSave = (next: string) => {
    setRevisionSubtitle(next);
    schedule(buildExtras({ revision_subtitle: next }));
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6">
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
        icon={<ListOrdered size={14} className="text-faint" />}
        description="Numbered list shown above the accept form. Up to four steps."
        action={
          <button
            type="button"
            onClick={() => setStepsAndSave([...DEFAULT_DECISION_NEXT_STEPS])}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-medium text-faint w-6 shrink-0 tabular-nums">
                0{i + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={(e) =>
                  setStepsAndSave(steps.map((s, idx) => (idx === i ? e.target.value : s)))
                }
                placeholder={DEFAULT_DECISION_NEXT_STEPS[i] ?? 'Add a step…'}
                className="flex-1 px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
              <button
                type="button"
                onClick={() => setStepsAndSave(steps.filter((_, idx) => idx !== i))}
                disabled={steps.length <= 1}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
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
            className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
          >
            <Plus size={12} />
            Add step
          </button>
        )}
      </SectionCard>

      {/* Accept-form copy editor — heading, subtitle, agreement label. */}
      <SectionCard
        title="Accept Form Copy"
        icon={<MessageSquare size={14} className="text-faint" />}
        description="The headline, subtitle and agreement label shown on the Accept tab of the form. Leave blank to use the defaults."
        action={
          <button
            type="button"
            onClick={() => {
              setAcceptHeading(DEFAULT_DECISION_ACCEPT_HEADING);
              setAcceptSubtitle(DEFAULT_DECISION_ACCEPT_SUBTITLE);
              setAgreementText(DEFAULT_DECISION_AGREEMENT_TEXT);
              schedule(buildExtras({
                accept_heading: DEFAULT_DECISION_ACCEPT_HEADING,
                accept_subtitle: DEFAULT_DECISION_ACCEPT_SUBTITLE,
                agreement_text: DEFAULT_DECISION_AGREEMENT_TEXT,
              }));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Headline</label>
            <input
              type="text"
              value={acceptHeading}
              onChange={(e) => setAcceptHeadingAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_ACCEPT_HEADING}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Subtitle</label>
            <textarea
              value={acceptSubtitle}
              onChange={(e) => setAcceptSubtitleAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_ACCEPT_SUBTITLE}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Agreement Checkbox Label</label>
            <textarea
              value={agreementText}
              onChange={(e) => setAgreementTextAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_AGREEMENT_TEXT}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* Decline & Revision copy — heading + subtitle for those tabs. */}
      <SectionCard
        title="Decline & Revision Copy"
        icon={<MessageSquare size={14} className="text-faint" />}
        description="The headline and subtitle shown when clients switch to the Decline or Request Changes tab."
        action={
          <button
            type="button"
            onClick={() => {
              setDeclineHeading(DEFAULT_DECISION_DECLINE_HEADING);
              setDeclineSubtitle(DEFAULT_DECISION_DECLINE_SUBTITLE);
              setRevisionHeading(DEFAULT_DECISION_REVISION_HEADING);
              setRevisionSubtitle(DEFAULT_DECISION_REVISION_SUBTITLE);
              schedule(buildExtras({
                decline_heading: DEFAULT_DECISION_DECLINE_HEADING,
                decline_subtitle: DEFAULT_DECISION_DECLINE_SUBTITLE,
                revision_heading: DEFAULT_DECISION_REVISION_HEADING,
                revision_subtitle: DEFAULT_DECISION_REVISION_SUBTITLE,
              }));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Decline Headline</label>
            <input
              type="text"
              value={declineHeading}
              onChange={(e) => setDeclineHeadingAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_DECLINE_HEADING}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Decline Subtitle</label>
            <textarea
              value={declineSubtitle}
              onChange={(e) => setDeclineSubtitleAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_DECLINE_SUBTITLE}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Request Changes Headline</label>
            <input
              type="text"
              value={revisionHeading}
              onChange={(e) => setRevisionHeadingAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_REVISION_HEADING}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Request Changes Subtitle</label>
            <textarea
              value={revisionSubtitle}
              onChange={(e) => setRevisionSubtitleAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_REVISION_SUBTITLE}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* Button labels — submit button text per tab. */}
      <SectionCard
        title="Button Labels"
        icon={<MessageSquare size={14} className="text-faint" />}
        description="Text on the submit button for each tab (Accept / Decline / Request Changes)."
        action={
          <button
            type="button"
            onClick={() => {
              setAcceptButtonLabel(DEFAULT_DECISION_ACCEPT_BUTTON_LABEL);
              setDeclineButtonLabel(DEFAULT_DECISION_DECLINE_BUTTON_LABEL);
              setRevisionButtonLabel(DEFAULT_DECISION_REVISION_BUTTON_LABEL);
              schedule(buildExtras({
                accept_button_label: DEFAULT_DECISION_ACCEPT_BUTTON_LABEL,
                decline_button_label: DEFAULT_DECISION_DECLINE_BUTTON_LABEL,
                revision_button_label: DEFAULT_DECISION_REVISION_BUTTON_LABEL,
              }));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Accept Button</label>
            <input
              type="text"
              value={acceptButtonLabel}
              onChange={(e) => setAcceptButtonLabelAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_ACCEPT_BUTTON_LABEL}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Request Changes Button</label>
            <input
              type="text"
              value={revisionButtonLabel}
              onChange={(e) => setRevisionButtonLabelAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_REVISION_BUTTON_LABEL}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-prose">Decline Button</label>
            <input
              type="text"
              value={declineButtonLabel}
              onChange={(e) => setDeclineButtonLabelAndSave(e.target.value)}
              placeholder={DEFAULT_DECISION_DECLINE_BUTTON_LABEL}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>
        </div>
      </SectionCard>

      {/* Terms editor */}
      <SectionCard
        title="Terms & Conditions"
        icon={<FileText size={14} className="text-faint" />}
        description="Plain text shown beneath the Next Steps. Use line breaks for paragraphs."
        action={
          <button
            type="button"
            onClick={() => setTermsAndSave(DEFAULT_DECISION_TERMS)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-prose hover:bg-surface transition-colors"
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
          className="w-full px-3 py-2.5 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
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
          acceptHeading={acceptHeading}
          acceptSubtitle={acceptSubtitle}
          agreementText={agreementText}
          acceptButtonLabel={acceptButtonLabel}
          declineButtonLabel={declineButtonLabel}
          revisionButtonLabel={revisionButtonLabel}
          declineHeading={declineHeading}
          declineSubtitle={declineSubtitle}
          revisionHeading={revisionHeading}
          revisionSubtitle={revisionSubtitle}
        />
      </StickyPreviewAside>
    </div>
  );
}
