// app/templates/[id]/pages/page.tsx
'use client';

import PageEditor from '@/components/admin/page-editor/PageEditor';
import DecisionPageCard from '@/components/admin/proposals/DecisionPageCard';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplatePagesPage() {
  const { template, refetch } = useTemplateDetail();

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 py-6">
      <PageEditor
        proposalId={template.id}
        tableName="templates"
        bottomContent={
          <DecisionPageCard
            entityId={template.id}
            table="proposal_templates"
            initialEnabled={template.decision_page_enabled}
            initialTitle={template.decision_page_title}
            onSaved={refetch}
            titleOnly
          />
        }
      />
    </div>
  );
}
