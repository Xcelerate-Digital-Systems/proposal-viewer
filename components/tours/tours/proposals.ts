// components/tours/tours/proposals.ts
import type { Step } from 'react-joyride';

export const proposalsTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Proposal Builder',
    content:
      'Build beautiful proposals and send them to clients for review. They can accept, decline, or request changes — all tracked here.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="proposals-new"]',
    placement: 'bottom',
    title: 'Create a proposal',
    content:
      'Start from a blank page, upload an existing PDF, or pick from the Template Library to get going fast.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="proposals-view-toggle"]',
    placement: 'bottom',
    title: 'Switch views',
    content:
      'Toggle between Board, Grid, and List views. Board view gives you a Kanban pipeline so you can see every proposal by status at a glance.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="proposals-list"]',
    placement: 'bottom-start',
    title: 'Your proposals',
    content:
      'Each card shows the client, status, and value. Click any card to open the editor — drag cards between columns in Board view to update status.',
    skipBeacon: true,
  },
];
