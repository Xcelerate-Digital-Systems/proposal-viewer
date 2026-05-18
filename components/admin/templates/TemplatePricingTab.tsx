// components/admin/templates/TemplatePricingTab.tsx
'use client';

import PricingSection from '@/components/admin/builder-sections/PricingSection';

interface TemplatePricingTabProps {
  templateId: string;
  companyId: string;
}

export default function TemplatePricingTab({ templateId, companyId }: TemplatePricingTabProps) {
  return (
    <PricingSection
      apiBase="/api/templates/pages"
      entityKey="template_id"
      entityId={templateId}
      companyId={companyId}
      extraPostFields={{ company_id: companyId }}
      hideProposalDate
    />
  );
}
