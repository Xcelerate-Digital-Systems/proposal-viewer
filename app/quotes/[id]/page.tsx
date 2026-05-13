// app/quotes/[id]/page.tsx
'use client';

import QuoteBuilderV2 from '@/components/admin/quotes/QuoteBuilderV2';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteBuilderPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <QuoteBuilderV2 proposal={proposal} companyId={companyId} onRefetch={refetch} />
    </div>
  );
}
