'use client';

import { Check, Layers } from 'lucide-react';
import { REVIEW_STATUS_ORDER, getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackStatus } from '@/lib/types/feedback';

export default function StagesChipRow({
  selected, onToggle, onReset, audience = 'member', savedKeys, savedPrefix,
}: {
  selected: string[];
  onToggle: (stage: FeedbackStatus) => void;
  onReset: () => void;
  audience?: 'member' | 'guest';
  savedKeys: Set<string>;
  savedPrefix: string;
}) {
  const allStages = REVIEW_STATUS_ORDER;
  const visibleStages = audience === 'guest'
    ? allStages.filter((s) => s === 'client_review' || s === 'approved' || s === 'rejected')
    : allStages;
  const allDefault = selected.length === 0;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-edge">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Layers size={11} className="text-faint" />
        <span className="text-detail font-medium text-dim">Stages</span>
        {!allDefault && (
          <>
            <span className="text-detail text-faint">·</span>
            <button
              type="button"
              onClick={onReset}
              className="text-detail text-teal hover:text-teal/80 transition-colors"
            >
              Reset to all
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {/* "All" chip */}
        <button
          type="button"
          onClick={onReset}
          aria-pressed={allDefault}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
            allDefault
              ? 'bg-teal/10 text-teal border-teal/20'
              : 'bg-white text-faint border-edge-strong hover:text-prose hover:border-edge-hover'
          }`}
        >
          All
        </button>
        {visibleStages.map((s) => {
          const def = getFeedbackStatusDef(s);
          const on = selected.includes(s);
          const justSaved = savedKeys.has(`${savedPrefix}-${s}`);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
                on
                  ? `${def.bg} ${def.text} ${def.border}`
                  : 'bg-white text-faint border-edge-strong hover:text-prose hover:border-edge-hover'
              }`}
              title={on ? `Scoped to ${def.label}` : `Click to scope to ${def.label}`}
            >
              {justSaved ? (
                <Check size={9} className="text-emerald-500" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${on ? def.dot : 'bg-faint'}`} />
              )}
              {def.label}
            </button>
          );
        })}
      </div>
      {audience === 'guest' && (
        <p className="text-2xs text-faint mt-1.5">
          Guests can only be assigned to client-facing stages.
        </p>
      )}
    </div>
  );
}
