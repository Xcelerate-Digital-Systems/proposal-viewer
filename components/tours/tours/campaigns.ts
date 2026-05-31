// components/tours/tours/campaigns.ts
import type { Step } from 'react-joyride';

export const campaignsTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Campaigns',
    content:
      'Collect structured client feedback on creative assets — ads, emails, web pages, videos, and more. Each campaign tracks assets through review stages with pin comments and annotations.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="campaigns-new"]',
    placement: 'bottom',
    title: 'Create a campaign',
    content:
      'Set up a new campaign, add your assets, invite reviewers, and share a link with your client.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="campaigns-list"]',
    placement: 'bottom-start',
    title: 'Your campaigns',
    content:
      'Track every campaign by status. Open any project to see its Kanban board, asset list, or whiteboard view. Drag assets between stages as they move through review.',
    skipBeacon: true,
  },
];
