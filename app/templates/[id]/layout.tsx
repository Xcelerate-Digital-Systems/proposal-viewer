// app/templates/[id]/layout.tsx
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import TemplateDetailHeader from '@/components/admin/templates/TemplateDetailHeader';
import { TemplateDetailProvider } from '@/components/admin/templates/TemplateDetailContext';
import { EditorSaveStatusProvider } from '@/components/admin/EditorSaveStatusContext';
import { EditorUndoProvider } from '@/components/admin/EditorUndoContext';

export default function TemplateDetailLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  return (
    <AdminLayout>
      {(auth) => (
        <DetailShell templateId={params.id} companyId={auth.companyId ?? ''}>
          {children}
        </DetailShell>
      )}
    </AdminLayout>
  );
}

function DetailShell({
  templateId,
  companyId,
  children,
}: {
  templateId: string;
  companyId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

  const fetchTemplate = useCallback(async () => {
    if (!companyId) return;
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

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('bg_primary')
      .eq('id', companyId)
      .single();
    if (data?.bg_primary) {
      setCompanyBgPrimary(data.bg_primary);
    }
  }, [companyId]);

  useEffect(() => {
    fetchTemplate();
    fetchCompany();
  }, [fetchTemplate, fetchCompany]);

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <TemplateDetailProvider
      value={{
        template,
        refetch: fetchTemplate,
        companyId,
        companyBgPrimary,
      }}
    >
      <EditorSaveStatusProvider>
        <EditorUndoProvider>
          <div className="flex flex-col h-full">
            <TemplateDetailHeader template={template} />
            {children}
          </div>
        </EditorUndoProvider>
      </EditorSaveStatusProvider>
    </TemplateDetailProvider>
  );
}
