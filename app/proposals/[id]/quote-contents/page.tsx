// app/proposals/[id]/quote-contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteContentsPage() {
  const { proposal } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
      <TocTab entityType="proposal" entityId={proposal.id} />
    </div>
  );
}
