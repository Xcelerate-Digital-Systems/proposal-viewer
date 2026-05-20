// app/proposals/[id]/contents/page.tsx
'use client';

import TocTab from '@/components/admin/shared/TocTab';
import DecisionPageCard from '@/components/admin/proposals/DecisionPageCard';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalContentsPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <TocTab entityType="proposal" entityId={proposal.id} />
      <DecisionPageCard
        entityId={proposal.id}
        initialEnabled={proposal.decision_page_enabled}
        initialTitle={proposal.decision_page_title}
        onSaved={refetch}
      />
    </div>
  );
}
