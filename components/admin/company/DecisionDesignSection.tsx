'use client';

import { Check, RotateCcw, CheckSquare } from 'lucide-react';
import ColorPickerField from '@/components/ui/ColorPickerField';

interface Props {
  isOwner: boolean;
  saving: string | null;
  lastSaved: boolean;
  decisionBgColor: string | null;
  setDecisionBgColor: (v: string | null) => void;
  decisionTextColor: string | null;
  setDecisionTextColor: (v: string | null) => void;
  decisionHeadingColor: string | null;
  setDecisionHeadingColor: (v: string | null) => void;
  decisionAcceptButtonColor: string | null;
  setDecisionAcceptButtonColor: (v: string | null) => void;
  decisionDeclineButtonColor: string | null;
  setDecisionDeclineButtonColor: (v: string | null) => void;
  decisionRevisionButtonColor: string | null;
  setDecisionRevisionButtonColor: (v: string | null) => void;
  decisionCheckboxColor: string | null;
  setDecisionCheckboxColor: (v: string | null) => void;
  textPageBgColor: string;
  textPageTextColor: string;
  textPageHeadingColor: string | null;
  accentColor: string;
}

export default function DecisionDesignSection({
  isOwner,
  saving,
  lastSaved,
  decisionBgColor,
  setDecisionBgColor,
  decisionTextColor,
  setDecisionTextColor,
  decisionHeadingColor,
  setDecisionHeadingColor,
  decisionAcceptButtonColor,
  setDecisionAcceptButtonColor,
  decisionDeclineButtonColor,
  setDecisionDeclineButtonColor,
  decisionRevisionButtonColor,
  setDecisionRevisionButtonColor,
  decisionCheckboxColor,
  setDecisionCheckboxColor,
  textPageBgColor,
  textPageTextColor,
  textPageHeadingColor,
  accentColor,
}: Props) {
  const resetAll = () => {
    setDecisionBgColor(null);
    setDecisionTextColor(null);
    setDecisionHeadingColor(null);
    setDecisionAcceptButtonColor(null);
    setDecisionDeclineButtonColor(null);
    setDecisionRevisionButtonColor(null);
    setDecisionCheckboxColor(null);
  };

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Decision Page Design</span>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check size={12} /> Saved
            </span>
          )}
          {saving === 'decision_design' && (
            <div className="w-3.5 h-3.5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          )}
        </div>
      </div>
      <p className="text-xs text-faint mb-4">
        Colours for the Accept / Decline / Request Changes form. Applies globally to proposals and quotes. Leave blank to inherit from Content Page colours.
      </p>

      <fieldset disabled={!isOwner} className="space-y-4">
        <ColorPickerField
          label="Background"
          value={decisionBgColor}
          fallback={textPageBgColor}
          onChange={setDecisionBgColor}
          onReset={() => setDecisionBgColor(null)}
        />
        <ColorPickerField
          label="Text"
          value={decisionTextColor}
          fallback={textPageTextColor}
          onChange={setDecisionTextColor}
          onReset={() => setDecisionTextColor(null)}
        />
        <ColorPickerField
          label="Headline"
          value={decisionHeadingColor}
          fallback={textPageHeadingColor || textPageTextColor}
          onChange={setDecisionHeadingColor}
          onReset={() => setDecisionHeadingColor(null)}
        />
        <ColorPickerField
          label="Accept Button"
          value={decisionAcceptButtonColor}
          fallback={decisionHeadingColor || textPageHeadingColor || textPageTextColor}
          onChange={setDecisionAcceptButtonColor}
          onReset={() => setDecisionAcceptButtonColor(null)}
        />
        <ColorPickerField
          label="Decline Button"
          value={decisionDeclineButtonColor}
          fallback="#dc2626"
          onChange={setDecisionDeclineButtonColor}
          onReset={() => setDecisionDeclineButtonColor(null)}
        />
        <ColorPickerField
          label="Request Changes Button"
          value={decisionRevisionButtonColor}
          fallback={decisionHeadingColor || textPageHeadingColor || textPageTextColor}
          onChange={setDecisionRevisionButtonColor}
          onReset={() => setDecisionRevisionButtonColor(null)}
        />
        <ColorPickerField
          label="Checkbox"
          value={decisionCheckboxColor}
          fallback={accentColor}
          onChange={setDecisionCheckboxColor}
          onReset={() => setDecisionCheckboxColor(null)}
        />

        {isOwner && (
          <button
            type="button"
            onClick={resetAll}
            className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
          >
            <RotateCcw size={12} />
            Reset all to inherit
          </button>
        )}
      </fieldset>
    </div>
  );
}
