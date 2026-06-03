'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { fontFamily } from '@/lib/google-fonts';

/**
 * First-visit guided tour for the public whiteboard viewer.
 *
 * Spotlights the sidebar, the canvas, and the React Flow controls, in sync
 * with the tone/behavior of the website widget's tour (tour.ts). Shown once
 * per reviewer (localStorage-gated) on desktop only — the whiteboard itself
 * hides on <lg screens, so the tour never mounts on mobile.
 */

const TOUR_KEY = 'aviz_whiteboard_tour_v1';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

interface WhiteboardTourProps {
  /** Defer activation until guest identity is hydrated + known (post-onboarding). */
  enabled: boolean;
  accentColor?: string;
  fontHeading?: string | null;
}

const CALLOUT_WIDTH = 300;

export default function WhiteboardTour({
  enabled,
  accentColor = '#017C87',
  fontHeading,
}: WhiteboardTourProps) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const steps = useMemo<TourStep[]>(
    () => [
      {
        selector: '[data-wb-tour="sidebar"]',
        title: 'Your feedback items',
        body: "Every item you've been invited to review is listed here, grouped by type. Click any row to open it.",
      },
      {
        selector: '[data-wb-tour="canvas"]',
        title: 'Explore the board',
        body: 'Items are laid out as a flow showing how they connect. Click any card to open it and leave feedback — drag to pan, scroll to zoom.',
      },
      {
        selector: '.react-flow__controls',
        title: 'Navigate the board',
        body: 'Use these controls to zoom in and out or snap the whole board back into view.',
      },
    ],
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(TOUR_KEY) === '1') return;
    } catch {}
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, [enabled]);

  const measure = useCallback(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [active, stepIdx, steps]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // React Flow mounts its controls after an extra paint; retry a few times
    // so step 3 finds .react-flow__controls even if the target wasn't ready
    // on first measure.
    const retries = [80, 240, 600].map((d) => setTimeout(measure, d));
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      retries.forEach(clearTimeout);
    };
  }, [active, stepIdx, measure]);

  const end = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {}
  }, []);

  const next = useCallback(() => {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else end();
  }, [stepIdx, steps.length, end]);

  if (!active) return null;

  const step = steps[stepIdx];
  const total = steps.length;
  const isLast = stepIdx === total - 1;
  const headingFont = fontHeading ? fontFamily(fontHeading) : undefined;

  // Callout placement: vertically center on target, prefer the side with more
  // room; fall back to centering over the target when the target is very wide
  // (e.g. the full canvas).
  let calloutTop = 120;
  let calloutLeft = 120;
  let arrow: 'left' | 'right' | 'none' = 'none';
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 20;
    const centerY = Math.max(20, Math.min(rect.top + rect.height / 2 - 90, vh - 200));
    if (rect.width > vw * 0.55) {
      calloutTop = centerY;
      calloutLeft = Math.max(20, Math.min(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, vw - CALLOUT_WIDTH - 20));
      arrow = 'none';
    } else {
      const roomRight = vw - (rect.left + rect.width) - gap - CALLOUT_WIDTH;
      const roomLeft = rect.left - gap - CALLOUT_WIDTH;
      if (roomRight >= 20) {
        calloutTop = centerY;
        calloutLeft = rect.left + rect.width + gap;
        arrow = 'left';
      } else if (roomLeft >= 20) {
        calloutTop = centerY;
        calloutLeft = rect.left - CALLOUT_WIDTH - gap;
        arrow = 'right';
      } else {
        calloutTop = centerY;
        calloutLeft = Math.max(20, Math.min(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, vw - CALLOUT_WIDTH - 20));
        arrow = 'none';
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[2147483635]">
      <style>{`
        @keyframes wbTourFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wbTourCardIn {
          from { opacity: 0; transform: translateY(4px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes wbTourPulse {
          0%, 100% { box-shadow: 0 0 0 3px ${accentColor}, 0 0 22px ${accentColor}99; }
          50%      { box-shadow: 0 0 0 7px ${accentColor}44, 0 0 34px ${accentColor}; }
        }
      `}</style>

      {/* Backdrop with cut-out around the target */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ animation: 'wbTourFadeIn 200ms ease-out' }}
      >
        <defs>
          <mask id="wb-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 8}
                y={rect.top - 8}
                width={rect.width + 16}
                height={rect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15,23,42,0.55)" mask="url(#wb-tour-mask)" />
      </svg>

      {/* Glow outline around the spotlighted target */}
      {rect && (
        <div
          className="absolute pointer-events-none rounded-2xl"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            animation: 'wbTourPulse 1.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Callout card */}
      {rect && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wb-tour-title"
          className="absolute bg-white rounded-2xl px-5 py-4"
          style={{
            top: calloutTop,
            left: calloutLeft,
            width: CALLOUT_WIDTH,
            boxShadow: '0 20px 60px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.08)',
            animation: 'wbTourCardIn 200ms ease-out',
          }}
        >
          <div
            className="text-2xs uppercase tracking-[0.08em] font-semibold mb-1.5"
            style={{ color: accentColor }}
          >
            Step {stepIdx + 1} of {total}
          </div>
          <h4
            id="wb-tour-title"
            className="text-base font-semibold text-ink leading-tight mb-1.5"
            style={{ fontFamily: headingFont }}
          >
            {step.title}
          </h4>
          <p className="text-caption text-prose leading-[1.55] mb-4">{step.body}</p>
          <div className="flex items-center justify-between gap-2">
            {!isLast ? (
              <button
                type="button"
                onClick={end}
                className="text-xs font-medium text-faint hover:text-prose hover:bg-surface px-2 py-1.5 rounded-lg transition-all duration-300"
              >
                Skip tour
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={next}
              className="text-caption font-semibold text-white px-4 py-2 rounded-lg transition-all duration-300 hover:brightness-110"
              style={{ backgroundColor: accentColor }}
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
          {arrow !== 'none' && (
            <span
              aria-hidden
              className="absolute block w-3.5 h-3.5 bg-white"
              style={{
                top: '50%',
                [arrow]: '-7px',
                transform: 'translateY(-50%) rotate(45deg)',
                boxShadow:
                  arrow === 'left'
                    ? '-2px 2px 4px rgba(0,0,0,0.04)'
                    : '2px -2px 4px rgba(0,0,0,0.04)',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
