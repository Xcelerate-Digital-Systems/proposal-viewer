// components/tours/tours/funnels.ts
import type { Step } from 'react-joyride';

export const funnelsTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Funnel Planner',
    content:
      'Map out marketing funnels visually — awareness through conversion. Build from templates or start fresh, then share a read-only link with your client.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="funnels-new"]',
    placement: 'bottom',
    title: 'Create a funnel',
    content:
      'Pick a template (e-commerce, lead gen, content, etc.) or start from a blank canvas. Each template pre-builds stages and touchpoints you can customise.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="funnels-list"]',
    placement: 'bottom-start',
    title: 'Your funnels',
    content:
      'See all your funnels at a glance. Click any card to open the visual editor, duplicate it, or share a live link.',
    skipBeacon: true,
  },
];
