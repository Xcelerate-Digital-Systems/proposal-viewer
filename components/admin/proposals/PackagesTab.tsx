// components/admin/proposals/PackagesTab.tsx
'use client';

import PackagesSection from '@/components/admin/builder-sections/PackagesSection';

interface PackagesTabProps {
  proposalId: string;
}

export default function PackagesTab({ proposalId }: PackagesTabProps) {
  return (
    <PackagesSection
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={null}
    />
  );
}
