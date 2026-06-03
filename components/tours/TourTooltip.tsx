// components/tours/TourTooltip.tsx
// Branded tooltip that replaces the default react-joyride tooltip.
//
// Portaled to document.body so it escapes Joyride's Floating UI
// positioning container. Always renders dead-center of the viewport.
// Joyride's spotlight still highlights the target element behind it.

'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface TourTooltipProps {
  continuous: boolean;
  index: number;
  step: {
    title?: ReactNode;
    content: ReactNode;
    placement?: string;
  };
  size: number;
  isLastStep: boolean;
  primaryProps: Record<string, unknown>;
  backProps: Record<string, unknown>;
  skipProps: Record<string, unknown>;
  closeProps: Record<string, unknown>;
  tooltipProps: Record<string, unknown>;
}

export function TourTooltip({
  index,
  step,
  size,
  isLastStep,
  primaryProps,
  backProps,
  skipProps,
  closeProps,
  tooltipProps,
}: TourTooltipProps) {
  const isWelcome = index === 0 && step.placement === 'center';
  const progress = ((index + 1) / size) * 100;

  const tooltip = (
    <div
      // Keep the data attrs / aria Joyride needs, but NOT its positioning
      data-tour-elem="tooltip"
      role="alertdialog"
      className="animate-enter-up"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100000,
        maxWidth: isWelcome ? 440 : 400,
        width: 'calc(100vw - 48px)',
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-edge/80">
        {/* ── Branded header bar ─────────────────────────── */}
        <div className="bg-surface-dark flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/agencyviz_icon.svg"
              alt=""
              className="w-6 h-6 rounded-md"
            />
            <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
              Getting Started
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xs text-white/50 font-medium tabular-nums">
              {index + 1} / {size}
            </span>
            <button
              {...(closeProps as Record<string, unknown>)}
              className="text-white/40 hover:text-white transition-colors"
              aria-label="Close tour"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Progress bar ───────────────────────────────── */}
        <div className="h-0.5 bg-surface">
          <div
            className="h-full bg-teal transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Welcome logo block (first centered step only) */}
        {isWelcome && (
          <div className="flex flex-col items-center pt-7 pb-2 px-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-dark flex items-center justify-center mb-4 shadow-sm">
              <img
                src="/agencyviz_icon.svg"
                alt="AgencyViz"
                className="w-9 h-9"
              />
            </div>
          </div>
        )}

        {/* ── Content ────────────────────────────────────── */}
        <div className={`px-6 ${isWelcome ? 'pt-0 pb-2 text-center' : 'pt-5 pb-2'}`}>
          {step.title && (
            <h3 className="text-base font-semibold text-ink mb-1.5 leading-snug">
              {step.title}
            </h3>
          )}
          <p className="text-sm text-muted leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* ── Footer buttons ─────────────────────────────── */}
        <div className="px-6 pt-3 pb-5 flex items-center justify-between gap-3">
          <button
            {...(skipProps as Record<string, unknown>)}
            className="text-xs text-faint hover:text-ink transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...(backProps as Record<string, unknown>)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors"
              >
                <ArrowLeft size={13} />
                Back
              </button>
            )}
            <button
              {...(primaryProps as Record<string, unknown>)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal hover:bg-teal-hover rounded-lg transition-colors shadow-sm"
            >
              {isLastStep ? 'Got it' : 'Next'}
              {!isLastStep && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Joyride renders tooltipComponent inside a Floating UI positioned
  // wrapper. Portal to document.body to break out of that container
  // so our fixed centering actually works.
  if (typeof document !== 'undefined') {
    return createPortal(tooltip, document.body);
  }
  return tooltip;
}
