// app/templates/[id]/details/page.tsx
'use client';

import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import { useToast } from '@/components/ui/Toast';
import PostAcceptSection from '@/components/admin/proposals/PostAcceptSection';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateDetailsPage() {
  const { template, refetch } = useTemplateDetail();
  const toast = useToast();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 space-y-4">
      <EditDetailsPanel
        type="template"
        id={template.id}
        initialValues={{
          name: template.name,
          description: template.description,
        }}
        onSave={() => {
          toast.success('Details saved');
          refetch();
        }}
      />
      <PostAcceptSection
        entityId={template.id}
        table="proposal_templates"
        initialAction={template.post_accept_action ?? null}
        initialRedirectUrl={template.post_accept_redirect_url ?? null}
        initialMessage={template.post_accept_message ?? null}
      />
    </div>
  );
}
