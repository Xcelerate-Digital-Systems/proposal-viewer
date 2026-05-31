// components/tours/tour-config.ts
// Registry of all in-app tours. Adding a new tour = one entry here +
// a steps file imported below + `data-tour="..."` attrs on the target
// DOM nodes. TourProvider does the rest.

import type { Step } from 'react-joyride';
import { dashboardTour } from './tours/dashboard';
import { proposalsTour } from './tours/proposals';
import { quotesTour } from './tours/quotes';
import { documentsTour } from './tours/documents';
import { campaignsTour } from './tours/campaigns';
import { funnelsTour } from './tours/funnels';
import { swipeTour } from './tours/swipe';
import { integrationsTour } from './tours/integrations';

export type TourId =
  | 'dashboard'
  | 'proposals'
  | 'quotes'
  | 'documents'
  | 'campaigns'
  | 'funnels'
  | 'swipe'
  | 'integrations';

type TourEntry = {
  id: TourId;
  steps: Step[];
  matchesPath: (pathname: string) => boolean;
  /** The canonical path to navigate to before starting this tour. */
  path: string;
  label: string;
};

const REGISTRY: Record<TourId, TourEntry> = {
  dashboard: {
    id: 'dashboard',
    steps: dashboardTour,
    matchesPath: (p) => p === '/dashboard',
    path: '/dashboard',
    label: 'Dashboard tour',
  },
  proposals: {
    id: 'proposals',
    steps: proposalsTour,
    matchesPath: (p) => p === '/proposals',
    path: '/proposals',
    label: 'Proposals tour',
  },
  quotes: {
    id: 'quotes',
    steps: quotesTour,
    matchesPath: (p) => p === '/quotes',
    path: '/quotes',
    label: 'Quotes tour',
  },
  documents: {
    id: 'documents',
    steps: documentsTour,
    matchesPath: (p) => p === '/documents',
    path: '/documents',
    label: 'Documents tour',
  },
  campaigns: {
    id: 'campaigns',
    steps: campaignsTour,
    matchesPath: (p) => p === '/campaigns',
    path: '/campaigns',
    label: 'Campaigns tour',
  },
  funnels: {
    id: 'funnels',
    steps: funnelsTour,
    matchesPath: (p) => p === '/funnels',
    path: '/funnels',
    label: 'Funnels tour',
  },
  swipe: {
    id: 'swipe',
    steps: swipeTour,
    matchesPath: (p) => p.startsWith('/ads/swipe'),
    path: '/ads/swipe',
    label: 'Swipe Vault tour',
  },
  integrations: {
    id: 'integrations',
    steps: integrationsTour,
    matchesPath: (p) => p.startsWith('/integrations'),
    path: '/integrations/looker-studio',
    label: 'Integrations tour',
  },
};

export function getTour(id: TourId): TourEntry | null {
  return REGISTRY[id] ?? null;
}

export function resolveTourForPath(pathname: string): TourId | null {
  for (const tour of Object.values(REGISTRY)) {
    if (tour.steps.length === 0) continue;
    if (tour.matchesPath(pathname)) return tour.id;
  }
  return null;
}

export function listTours(): TourEntry[] {
  return Object.values(REGISTRY);
}
