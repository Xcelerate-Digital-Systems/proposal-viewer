// components/admin/proposals/PackagesTab.tsx
'use client';

import PackagesTabEditor from '@/components/admin/shared/PackagesTabEditor';

interface PackagesTabProps {
  proposalId: string;
}

export default function PackagesTab({ proposalId }: PackagesTabProps) {
  return (
    <PackagesTabEditor
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={null} // resolved from fetched page data
    />
  );
}