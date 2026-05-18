// app/proposals/[id]/pricing/page.tsx
'use client';

import PricingTab from '@/components/admin/proposals/PricingTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalPricingPage() {
  const { proposal } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <PricingTab proposalId={proposal.id} />
    </div>
  );
}
