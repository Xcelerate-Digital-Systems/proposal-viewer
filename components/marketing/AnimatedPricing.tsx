'use client';

// Animated pricing panel. Monthly/Yearly toggle with a sliding teal pill +
// NumberFlow rolling price. monthly/yearly are passed in (sourced from the DB
// plan upstream), so this stays presentation-only. Client leaf — isolates the
// motion + NumberFlow so server pages can render it.

import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { Check } from '@phosphor-icons/react';

type Cta =
  | { mode: 'link'; href: string; label: string }
  | { mode: 'node'; node: ReactNode };

interface AnimatedPricingProps {
  planName: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: Cta;
  /** Compact variant for the homepage teaser (tighter padding, 2-col features). */
  compact?: boolean;
}

export function AnimatedPricing({
  planName, monthly, yearly, features, cta, compact,
}: AnimatedPricingProps) {
  const [yearlyOn, setYearlyOn] = useState(false);
  const reduce = useReducedMotion();

  const savedMonths = Math.max(0, Math.round(((monthly * 12 - yearly) / monthly) * 10) / 10);
  const price = yearlyOn ? yearly : monthly;

  return (
    <div className="max-w-md mx-auto">
      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <div role="radiogroup" aria-label="Billing period" className="relative flex w-fit rounded-2xl bg-surface border border-edge p-1">
          <ToggleButton active={!yearlyOn} reduce={reduce} onClick={() => setYearlyOn(false)}>
            Monthly
          </ToggleButton>
          <ToggleButton active={yearlyOn} reduce={reduce} onClick={() => setYearlyOn(true)}>
            <span className="flex items-center gap-2">
              Yearly
              {savedMonths > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${yearlyOn ? 'bg-white/20 text-white' : 'bg-teal/10 text-teal'}`}>
                  Save {savedMonths} {savedMonths === 1 ? 'mo' : 'mos'}
                </span>
              )}
            </span>
          </ToggleButton>
        </div>
      </div>

      {/* Plan card */}
      <div className="relative bg-white border border-edge rounded-3xl shadow-card overflow-hidden ring-1 ring-teal/15">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal/40 via-teal to-teal/40" />
        <div className={`px-8 ${compact ? 'pt-7 pb-5' : 'pt-9 pb-7'}`}>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-ink">{planName}</h3>
            <span className="text-2xs uppercase tracking-wider text-teal font-semibold bg-teal/8 rounded-full px-2 py-0.5">
              Founding member
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-ink leading-none tabular-nums">
              $<NumberFlow value={price} respectMotionPreference />
            </span>
            <span className="text-dim">/{yearlyOn ? 'year' : 'month'}</span>
          </div>
          <p className="text-xs text-dim mt-2 h-4">
            {yearlyOn
              ? `Billed once a year. ${savedMonths > 0 ? `That's ${savedMonths} months free.` : ''}`
              : `or $${yearly}/year${savedMonths > 0 ? ` and save ${savedMonths} months` : ''}.`}
          </p>

          <div className="mt-6">
            {cta.mode === 'link' ? (
              <a
                href={cta.href}
                className="press-scale inline-flex w-full items-center justify-center gap-2 h-12 px-6 text-base font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                {cta.label}
              </a>
            ) : (
              cta.node
            )}
          </div>
          <p className="text-2xs text-dim text-center mt-3">7-day free trial. Cancel any time.</p>
        </div>

        <div className="px-8 py-6 bg-surface/60 border-t border-edge">
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-faint mb-4">
            Everything included
          </h4>
          <ul className={`grid ${compact ? 'grid-cols-2' : 'sm:grid-cols-2'} gap-x-5 gap-y-2.5`}>
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <span className="h-5 w-5 rounded-full bg-teal/10 grid place-content-center shrink-0 mt-0.5">
                  <Check size={12} weight="bold" className="text-teal" />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active, reduce, onClick, children,
}: {
  active: boolean;
  reduce: boolean | null;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative z-10 h-11 rounded-xl px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ${
        active ? 'text-white' : 'text-muted hover:text-ink'
      }`}
    >
      {active && (
        <motion.span
          layoutId="billing-pill"
          className="absolute inset-0 rounded-xl bg-primary shadow-sm"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
