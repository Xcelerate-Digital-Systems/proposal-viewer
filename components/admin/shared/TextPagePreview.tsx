// components/admin/shared/TextPagePreview.tsx
// Live preview for a text page — matches the Quotes preview chrome (header bar,
// scaled viewer page, footer). Uses ViewerPagePreview so colour/spacing/background
// match the public viewer exactly; font sizes are scaled down with the page.
'use client';

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import TextPage from '@/components/viewer/TextPage';
import ViewerPagePreview from './ViewerPagePreview';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPagePreviewProps {
  form: TextPageForm;
  branding: CompanyBranding;
  entityId: string;
  companyId: string | null;
}

export default function TextPagePreview({ form, branding, entityId, companyId }: TextPagePreviewProps) {
  const textPage: ProposalTextPage = useMemo(() => ({
    id: 'preview',
    proposal_id: entityId,
    company_id: companyId ?? '',
    enabled: form.enabled,
    position: 0,
    title: form.title,
    content: form.content,
    sort_order: 0,
    indent: 0,
    show_member_badge: form.show_member_badge,
    show_client_logo: form.show_client_logo,
    prepared_by_member_id: form.prepared_by_member_id,
    show_title: form.show_title,
  }), [form, entityId, companyId]);

  return (
    <ViewerPagePreview
      branding={branding}
      label={form.title || 'Untitled'}
      icon={<FileText size={11} />}
      footer="Scales to fit"
    >
      <TextPage
        textPage={textPage}
        branding={branding}
        proposalTitle=""
        clientName=""
        companyName=""
        userName=""
      />
    </ViewerPagePreview>
  );
}
