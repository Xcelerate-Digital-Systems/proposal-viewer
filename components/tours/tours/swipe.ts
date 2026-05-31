// components/tours/tours/swipe.ts
import type { Step } from 'react-joyride';

export const swipeTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Swipe Vault',
    content:
      'Save ad inspiration and creative references, organised by type. Build a shared library your team can browse and learn from.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="swipe-types"]',
    placement: 'right',
    title: 'Ad types',
    content:
      'Create categories (e.g. Facebook Ads, Google Ads, Landing Pages) in the sidebar. Each type gets its own collection.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="swipe-content"]',
    placement: 'left',
    title: 'Your swipe files',
    content:
      'Add screenshots, links, and notes to each type. Share a curated collection with clients or teammates via a public link.',
    skipBeacon: true,
  },
];
