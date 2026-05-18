// app/proposals/[id]/contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalContentsPage() {
  const { proposal } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <TocTab entityType="proposal" entityId={proposal.id} />
    </div>
  );
}
