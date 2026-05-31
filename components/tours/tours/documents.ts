// components/tours/tours/documents.ts
import type { Step } from 'react-joyride';

export const documentsTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Doc Builder',
    content:
      'Create shareable documents — SOWs, case studies, onboarding guides — and send a branded link to your clients. Same editor as proposals, without the accept/decline flow.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="documents-new"]',
    placement: 'bottom',
    title: 'Create a document',
    content:
      'Start from a blank page or choose a template. Documents use the same rich editor and cover designer as proposals.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="documents-list"]',
    placement: 'bottom-start',
    title: 'Your documents',
    content:
      'All your documents in one place. Click any card to open the editor, then share via a secure link.',
    skipBeacon: true,
  },
];
