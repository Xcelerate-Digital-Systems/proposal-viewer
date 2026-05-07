// app/proposals/[id]/quote-builder/page.tsx
'use client';

import QuoteBuilder from '@/components/admin/proposals/quote-builder/QuoteBuilder';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteBuilderPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <QuoteBuilder
        proposal={proposal}
        companyId={companyId}
        onRefetch={refetch}
      />
    </div>
  );
}
