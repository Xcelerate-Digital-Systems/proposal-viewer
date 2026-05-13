// app/quotes/[id]/cover/page.tsx
'use client';

import CoverEditor from '@/components/admin/proposals/CoverEditor';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteCoverPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6">
      <CoverEditor proposal={proposal} onSave={refetch} />
    </div>
  );
}
