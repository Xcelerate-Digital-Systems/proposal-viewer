// components/tours/tours/integrations.ts
import type { Step } from 'react-joyride';

export const integrationsTour: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Integrations',
    content:
      'Connect your ad accounts and CRM data to pipe live metrics into Looker Studio reports — no manual exports needed.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="integrations-connectors"]',
    placement: 'bottom',
    title: 'Available connectors',
    content:
      'Each connector card shows setup instructions and your deployment ID. Connect your accounts in Settings, then add the connector to any Looker Studio report.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar"]',
    placement: 'right',
    title: 'Manage connections',
    content:
      'Head to Settings → Integrations in the sidebar to connect and manage your ad accounts. Connected accounts appear across all your Looker Studio reports automatically.',
    skipBeacon: true,
  },
];
