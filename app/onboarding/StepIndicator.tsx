'use client';

import { Check } from 'lucide-react';
import { type Step, STEPS } from './onboarding-types';

export function StepIndicator({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    agency: 'Branding',
    invite: 'Invite',
    plan: 'Plan',
    done: 'Done',
  };
  const currentIdx = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      {STEPS.map((s, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                isPast
                  ? 'bg-white text-teal'
                  : isCurrent
                    ? 'bg-white text-teal ring-2 ring-white/40'
                    : 'bg-white/15 text-white/60'
              }`}
            >
              {isPast ? <Check size={14} /> : idx + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                isCurrent ? 'text-white' : 'text-white/60'
              }`}
            >
              {labels[s]}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-white/15 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}
