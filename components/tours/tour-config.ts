// components/tours/tour-config.ts
// Registry of all in-app tours. Adding a new tour = one entry here +
// a steps file imported below + `data-tour="..."` attrs on the target
// DOM nodes. TourProvider does the rest.

import type { Step } from 'react-joyride';
import { dashboardTour } from './tours/dashboard';

export type TourId = 'dashboard' | 'proposals' | 'reviews' | 'integrations';

type TourEntry = {
  id: TourId;
  /** Steps Joyride walks the user through. */
  steps: Step[];
  /** Predicate: should this tour fire on this pathname? */
  matchesPath: (pathname: string) => boolean;
  /** Label shown next to the "?" replay button. */
  label: string;
};

const REGISTRY: Record<TourId, TourEntry> = {
  dashboard: {
    id: 'dashboard',
    steps: dashboardTour,
    matchesPath: (p) => p === '/dashboard',
    label: 'Dashboard tour',
  },
  // Stubs — flesh out the step arrays + add a tours/<name>.ts file when each
  // surface is ready for guided onboarding. Until then they exist in the
  // registry so the ReplayButton compile-time check passes.
  proposals: {
    id: 'proposals',
    steps: [],
    matchesPath: (p) => p === '/proposals' || p.startsWith('/proposals/'),
    label: 'Proposals tour',
  },
  reviews: {
    id: 'reviews',
    steps: [],
    matchesPath: (p) => p === '/campaigns' || p.startsWith('/campaigns/'),
    label: 'Reviews tour',
  },
  integrations: {
    id: 'integrations',
    steps: [],
    matchesPath: (p) => p.startsWith('/integrations'),
    label: 'Integrations tour',
  },
};

export function getTour(id: TourId): TourEntry | null {
  return REGISTRY[id] ?? null;
}

/** Pick the tour matching the current pathname, or null if none. */
export function resolveTourForPath(pathname: string): TourId | null {
  for (const tour of Object.values(REGISTRY)) {
    if (tour.steps.length === 0) continue; // stub — don't try to auto-fire
    if (tour.matchesPath(pathname)) return tour.id;
  }
  return null;
}

export function listTours(): TourEntry[] {
  return Object.values(REGISTRY);
}
