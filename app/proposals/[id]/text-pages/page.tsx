// app/proposals/[id]/text-pages/page.tsx
'use client';

import TextPagesTab from '@/components/admin/proposals/TextPagesTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalTextPagesPage() {
  const { proposal, companyId } = useProposalDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
      <TextPagesTab proposalId={proposal.id} companyId={companyId} />
    </div>
  );
}
