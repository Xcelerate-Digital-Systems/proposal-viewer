// components/tours/tours/quote-builder.ts
import type { Step } from 'react-joyride';

export const quoteBuilderTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to the Quote Builder',
    content:
      'Build itemised quotes section by section. Each group covers a different part of your quote — from client details to pricing to branding.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="quote-section-nav"]',
    placement: 'bottom',
    title: 'Section navigation',
    content:
      'Jump between sections using these pills. The active section highlights as you scroll.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="quote-line-items"]',
    placement: 'bottom',
    title: 'Line items',
    content:
      'Add your deliverables and pricing here. Press Enter on the last row to quickly add another item. Use the library bar to load saved templates.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="quote-preview"]',
    placement: 'left',
    title: 'Live preview',
    content:
      'See how your quote looks to clients in real time. Changes appear here as you edit.',
    skipBeacon: true,
  },
];
