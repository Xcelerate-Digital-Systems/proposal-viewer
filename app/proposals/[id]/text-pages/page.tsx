// app/proposals/[id]/text-pages/page.tsx
'use client';

import Link from 'next/link';
import TextPagesTab from '@/components/admin/proposals/TextPagesTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalTextPagesPage() {
  const { proposal, companyId } = useProposalDetail();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
      <p className="text-xs text-faint mb-4">
        Edit text page content and settings here. To reorder, add, or remove pages use the{' '}
        <Link href={`/proposals/${proposal.id}/pages`} className="text-teal hover:underline">Pages</Link> tab.
      </p>
      <TextPagesTab proposalId={proposal.id} companyId={companyId} />
    </div>
  );
}
