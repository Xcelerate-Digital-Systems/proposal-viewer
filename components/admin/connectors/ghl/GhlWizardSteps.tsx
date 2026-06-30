'use client';

// components/admin/connectors/ghl/GhlWizardSteps.tsx
//
// Wizard step navigation for the GHL connector setup flow.

import { Check } from 'lucide-react';
import { WIZARD_LABELS } from './ghl-types';

interface GhlWizardStepsProps {
  current: number;
  onStepClick: (step: number) => void;
}

export function GhlWizardSteps({ current, onStepClick }: GhlWizardStepsProps) {
  return (
    <nav aria-label="Setup progress" className="flex items-center gap-1">
      {WIZARD_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={() => onStepClick(step)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${
                active
                  ? 'bg-teal-tint text-teal'
                  : done
                    ? 'text-teal hover:bg-teal-tint/50'
                    : 'text-faint hover:text-muted'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold shrink-0 ${
                done
                  ? 'bg-teal text-white'
                  : active
                    ? 'bg-teal text-white'
                    : 'bg-surface text-faint'
              }`}>
                {done ? <Check size={10} /> : step}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < WIZARD_LABELS.length - 1 && (
              <div className={`w-4 h-px shrink-0 ${done ? 'bg-teal/40' : 'bg-edge'}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
