// app/templates/[id]/pages/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import TemplateDetailHeader from '@/components/admin/templates/TemplateDetailHeader';
import PageEditor from '@/components/admin/page-editor/PageEditor';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function TemplatePagesPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <PagesContent
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

function PagesContent({
  templateId,
  companyId,
}: {
  templateId: string;
  companyId: string;
}) {
  const router = useRouter();
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
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TemplateDetailHeader
        templateId={templateId}
        activeTab="pages"
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
        <PageEditor
          proposalId={templateId}
          tableName="templates"
          onSave={fetchTemplate}
        />
      </div>
    </div>
  );
}