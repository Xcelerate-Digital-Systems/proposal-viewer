// components/admin/proposals/TextPagesTab.tsx
'use client';

import TextPagesTabEditor from '@/components/admin/shared/TextPagesTabEditor';

interface TextPagesTabProps {
  proposalId: string;
  companyId: string;
}

export default function TextPagesTab({ proposalId, companyId }: TextPagesTabProps) {
  return (
    <TextPagesTabEditor
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={companyId}
    />
  );
}