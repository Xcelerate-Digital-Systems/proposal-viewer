// app/proposals/[id]/quote-packages/page.tsx
'use client';

import PackagesTab from '@/components/admin/proposals/PackagesTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuotePackagesPage() {
  const { proposal } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
      <PackagesTab proposalId={proposal.id} />
    </div>
  );
}
