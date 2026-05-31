// components/tours/tours/quotes.ts
import type { Step } from 'react-joyride';

export const quotesTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Quote Builder',
    content:
      'Create itemised quotes with line items, packages, and optional add-ons. Clients see a clean, interactive pricing page they can accept or negotiate.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="quotes-new"]',
    placement: 'bottom',
    title: 'Create a quote',
    content:
      'Start a new quote from scratch or use a template with pre-built packages and line items.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="quotes-list"]',
    placement: 'bottom-start',
    title: 'Your quotes',
    content:
      'Track every quote by status. Open any card to edit line items, add packages, customise the cover page, and share with your client.',
    skipBeacon: true,
  },
];
