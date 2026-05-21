// app/templates/[id]/decision/page.tsx
'use client';

import DecisionTab from '@/components/admin/proposals/DecisionTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateDecisionPage() {
  const { template, refetch } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-10 py-6">
      <DecisionTab
        entityId={template.id}
        table="proposal_templates"
        initialEnabled={template.decision_page_enabled}
        initialTitle={template.decision_page_title}
        initialExtras={template.decision_extras}
        onSaved={refetch}
      />
    </div>
  );
}
