// components/tours/tours/dashboard.ts
// Joyride steps for the /dashboard. The first step is a centered welcome
// modal with the AgencyViz logo (rendered by TourTooltip). Keep the
// tour short — orient-then-get-out-of-the-way.

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
    title: 'Campaigns inbox',
    content:
      'Client comments awaiting your reply appear at the top. Underneath, every active campaign — drag cards between columns to update status.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="dashboard-proposals"]',
    placement: 'bottom-start',
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
      "Jump between proposals, documents, campaigns, and integrations from here. Settings and billing live at the bottom.",
    skipBeacon: true,
  },
];
