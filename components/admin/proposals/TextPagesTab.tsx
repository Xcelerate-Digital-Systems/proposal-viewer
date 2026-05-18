// components/admin/proposals/TextPagesTab.tsx
'use client';

import TextPagesSection from '@/components/admin/builder-sections/TextPagesSection';

interface TextPagesTabProps {
  proposalId: string;
  companyId: string;
}

export default function TextPagesTab({ proposalId, companyId }: TextPagesTabProps) {
  return (
    <TextPagesSection
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={companyId}
    />
  );
}
