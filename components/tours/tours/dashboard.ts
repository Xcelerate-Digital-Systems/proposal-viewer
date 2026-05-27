// components/tours/tours/dashboard.ts
// Joyride steps for the /dashboard. Keep it short — 4 steps max. The
// goal is orient-then-get-out-of-the-way, not a full feature tour.
// Targets are `data-tour="..."` attributes on real DOM nodes.

import type { Step } from 'react-joyride';

export const dashboardTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to AgencyViz',
    content:
      "This is your dashboard — feedback that needs your reply on top, deal pipeline below. Let's take 30 seconds to look around.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-feedback"]',
    placement: 'bottom',
    title: 'Feedback inbox + projects',
    content:
      'Client comments awaiting your reply appear at the top. Underneath, every active feedback project — drag cards between columns to update status.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-proposals"]',
    placement: 'top',
    title: 'Proposals & quotes pipeline',
    content:
      'Everything you have in flight, by stage. Drag a card to move it forward. Click any card to open the builder.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar"]',
    placement: 'right',
    title: 'Everything else',
    content:
      "Jump between proposals, documents, feedback projects, and integrations from here. Settings and billing live at the bottom — that's also where you'll find the rest of the tours when you're ready.",
    skipBeacon: true,
  },
];
