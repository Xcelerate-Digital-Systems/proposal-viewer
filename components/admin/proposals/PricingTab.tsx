// components/admin/proposals/PricingTab.tsx
'use client';

import PricingTabEditor from '@/components/admin/shared/PricingTabEditor';

interface PricingTabProps {
  proposalId: string;
}

export default function PricingTab({ proposalId }: PricingTabProps) {
  return (
    <PricingTabEditor
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={null}
      proposalId={proposalId}
    />
  );
}
