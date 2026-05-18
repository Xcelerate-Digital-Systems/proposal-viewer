// app/proposals/[id]/cover/page.tsx
// Cover tab — content-only editor (logo, avatar, title, subtitle, prepared-by,
// dates, button text). Visual styling lives on the Design tab.
'use client';

import ProposalCoverEditor from '@/components/admin/proposals/CoverEditor';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalCoverPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <ProposalCoverEditor proposal={proposal} onSave={refetch} contentOnly />
    </div>
  );
}
