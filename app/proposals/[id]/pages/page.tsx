// app/proposals/[id]/pages/page.tsx
'use client';

import { PageEditor } from '@/components/admin/page-editor';
import DecisionPageCard from '@/components/admin/proposals/DecisionPageCard';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalPagesPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    // No own scroll — the page list inside PageEditor gets its own
    // overflow-y so the toolbar and preview aside stay pinned. Avoids the
    // nested-scroll experience where content scrolls under the proposal
    // header before the sticky preview kicks in.
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 py-6">
      <PageEditor
        proposalId={proposal.id}
        filePath={proposal.file_path}
        initialPageNames={proposal.page_names || []}
        onSave={() => refetch()}
        onCancel={() => {}}
        bottomContent={
          <DecisionPageCard
            entityId={proposal.id}
            initialEnabled={proposal.decision_page_enabled}
            initialTitle={proposal.decision_page_title}
            onSaved={refetch}
          />
        }
      />
    </div>
  );
}
