// app/proposals/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalDetailRedirect() {
  const router = useRouter();
  const { proposal } = useProposalDetail();

  useEffect(() => {
    if (proposal.entity_type === 'quote') {
      router.replace(`/quotes/${proposal.id}`);
    } else {
      router.replace(`/proposals/${proposal.id}/pages`);
    }
  }, [proposal.id, proposal.entity_type, router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
    </div>
  );
}
