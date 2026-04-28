// app/proposals/[id]/quote-pages/page.tsx
'use client';

import { PageEditor } from '@/components/admin/page-editor';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuotePagesPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6">
      <PageEditor
        proposalId={proposal.id}
        filePath={proposal.file_path}
        initialPageNames={proposal.page_names || []}
        onSave={() => refetch()}
        onCancel={() => {}}
      />
    </div>
  );
}
