// app/proposals/[id]/decision/page.tsx
'use client';

import DecisionTab from '@/components/admin/proposals/DecisionTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalDecisionPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <DecisionTab
        entityId={proposal.id}
        initialEnabled={proposal.decision_page_enabled}
        initialTitle={proposal.decision_page_title}
        initialExtras={proposal.decision_extras}
        onSaved={refetch}
      />
    </div>
  );
}
