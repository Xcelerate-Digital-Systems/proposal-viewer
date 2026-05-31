'use client';

import { use } from 'react';
import ProposalAnalytics from '@/components/admin/proposals/ProposalAnalytics';

export default function AnalyticsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  return <ProposalAnalytics proposalId={id} />;
}
