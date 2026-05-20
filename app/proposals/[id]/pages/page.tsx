// app/proposals/[id]/pages/page.tsx
'use client';

import { PageEditor } from '@/components/admin/page-editor';
import DecisionPageCard from '@/components/admin/proposals/DecisionPageCard';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalPagesPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <PageEditor
        proposalId={proposal.id}
        filePath={proposal.file_path}
        initialPageNames={proposal.page_names || []}
        onSave={() => refetch()}
        onCancel={() => {}}
      />
      <DecisionPageCard
        entityId={proposal.id}
        initialEnabled={proposal.decision_page_enabled}
        initialTitle={proposal.decision_page_title}
        onSaved={refetch}
      />
    </div>
  );
}
