// components/tours/SetupChecklist.tsx
// Persistent setup checklist panel. Shows all available tours with
// completion status. Navigates to the tour's page and starts it.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  X,
} from 'lucide-react';
import { useTour } from './TourProvider';
import { setPendingTour } from './TourProvider';
import { listTours, getTour, type TourId } from './tour-config';
import { useAuth } from '@/hooks/useAuth';

const COLLAPSED_KEY = 'agencyviz_checklist_collapsed';
const DISMISSED_KEY = 'agencyviz_checklist_dismissed';

const TOUR_META: Record<TourId, { label: string; description: string }> = {
  dashboard: {
    label: 'Dashboard overview',
    description: 'Your inbox, pipeline, and navigation',
  },
  proposals: {
    label: 'Proposal Builder',
    description: 'Create and manage client proposals',
  },
  quotes: {
    label: 'Quote Builder',
    description: 'Build itemised quotes for clients',
  },
  documents: {
    label: 'Doc Builder',
    description: 'Create shareable documents',
  },
  campaigns: {
    label: 'Campaigns',
    description: 'Collect client feedback on assets',
  },
  funnels: {
    label: 'Funnel Planner',
    description: 'Map out marketing funnels',
  },
  swipe: {
    label: 'Swipe Vault',
    description: 'Save and organise ad inspiration',
  },
  integrations: {
    label: 'Integrations',
    description: 'Connect Looker Studio reports',
  },
};

export function SetupChecklist() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { replay, isActive } = useTour();
  const [collapsed, setCollapsed] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1');
      return !prev;
    });
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  }, []);

  const startTour = useCallback(
    (tourId: TourId) => {
      if (isActive) return;
      const tour = getTour(tourId);
      if (!tour || tour.steps.length === 0) return;

      // Already on the tour's page — launch directly
      if (tour.matchesPath(pathname)) {
        replay(tourId);
        return;
      }

      // Different page — write to sessionStorage and navigate.
      // TourProvider picks it up after the page mounts.
      setPendingTour(tourId);
      router.push(tour.path);
    },
    [isActive, pathname, replay, router],
  );

  if (dismissed) return null;
  if (auth.loading || !auth.teamMember) return null;

  const completed =
    (auth.teamMember.tours_completed as Record<string, string> | undefined) ?? {};

  const tours = listTours();
  const activeTours = tours.filter((t) => t.steps.length > 0);
  const completedCount = activeTours.filter((t) => completed[t.id]).length;
  const totalCount = activeTours.length;
  const allDone = completedCount === totalCount && totalCount > 0;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed bottom-5 right-5 z-[9990] w-80 animate-enter-up">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* ── Header ────────────────────────────────── */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-surface-dark flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold text-ink block leading-tight">
                Setup Guide
              </span>
              <span className="text-2xs text-muted">
                {allDone
                  ? 'All done!'
                  : `${completedCount} of ${totalCount} completed`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Circular progress ring */}
            <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
              <circle
                cx="14" cy="14" r="11"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="2.5"
              />
              <circle
                cx="14" cy="14" r="11"
                fill="none"
                stroke="#017C87"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 11}`}
                strokeDashoffset={`${2 * Math.PI * 11 * (1 - progressPct / 100)}`}
                transform="rotate(-90 14 14)"
                className="transition-all duration-700 ease-out"
              />
              <text
                x="14" y="15"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-ink text-[8px] font-bold"
              >
                {completedCount}
              </text>
            </svg>
            {collapsed ? (
              <ChevronUp size={16} className="text-faint" />
            ) : (
              <ChevronDown size={16} className="text-faint" />
            )}
          </div>
        </button>

        {/* ── Progress bar ──────────────────────────── */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full bg-teal transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* ── Tour list ─────────────────────────────── */}
        {!collapsed && (
          <div className="px-2 py-2 max-h-[360px] overflow-y-auto">
            {tours.map((tour) => {
              const meta = TOUR_META[tour.id];
              const isDone = !!completed[tour.id];
              const hasSteps = tour.steps.length > 0;

              return (
                <button
                  key={tour.id}
                  onClick={() => {
                    if (hasSteps && !isActive) startTour(tour.id);
                  }}
                  disabled={!hasSteps || isActive}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group ${
                    hasSteps && !isActive
                      ? 'hover:bg-surface cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-teal" />
                    ) : (
                      <Circle size={18} className="text-gray-300 group-hover:text-teal/50 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm font-medium block leading-tight ${
                        isDone ? 'text-muted line-through' : 'text-ink'
                      }`}
                    >
                      {meta?.label ?? tour.label}
                    </span>
                    {meta?.description && (
                      <span className="text-2xs text-faint block mt-0.5">
                        {meta.description}
                      </span>
                    )}
                  </div>
                  {hasSteps && !isDone && !isActive && (
                    <span className="text-2xs text-teal font-medium mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      Start
                    </span>
                  )}
                </button>
              );
            })}

            {/* Dismiss link */}
            <div className="pt-2 pb-1 px-3 border-t border-gray-50 mt-1">
              <button
                onClick={dismiss}
                className="text-2xs text-faint hover:text-ink transition-colors flex items-center gap-1"
              >
                <X size={11} />
                Dismiss checklist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
