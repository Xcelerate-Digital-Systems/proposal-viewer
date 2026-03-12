// app/templates/[id]/details/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import TemplateDetailHeader from '@/components/admin/templates/TemplateDetailHeader';
import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import { useToast } from '@/components/ui/Toast';
import PostAcceptSection from '@/components/admin/proposals/PostAcceptSection';


/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function TemplateDetailsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <DetailsContent
          templateId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

function DetailsContent({
  templateId,
  companyId,
}: {
  templateId: string;
  companyId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTemplate = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/templates');
      return;
    }
    setTemplate(data);
    setLoading(false);
  }, [templateId, companyId, router]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TemplateDetailHeader
        templateId={templateId}
        activeTab="details"
      />

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
            fetchTemplate();
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
    </div>
  );
}