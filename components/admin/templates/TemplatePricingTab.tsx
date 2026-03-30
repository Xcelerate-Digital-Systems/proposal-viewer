// components/admin/templates/TemplatePricingTab.tsx
'use client';

import PricingTabEditor from '@/components/admin/shared/PricingTabEditor';

interface TemplatePricingTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplatePricingTab({ templateId, companyId }: TemplatePricingTabProps) {
  return (
    <PricingTabEditor
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
      hideProposalDate
    />
  );
}
