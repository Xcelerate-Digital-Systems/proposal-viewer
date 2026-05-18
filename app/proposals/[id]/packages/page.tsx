// app/proposals/[id]/packages/page.tsx
'use client';

import PackagesTab from '@/components/admin/proposals/PackagesTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalPackagesPage() {
  const { proposal } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <PackagesTab proposalId={proposal.id} />
    </div>
  );
}
