// app/templates/[id]/packages/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import TemplateDetailHeader from '@/components/admin/templates/TemplateDetailHeader';
import TemplatePackagesTab from '@/components/admin/templates/TemplatePackagesTab';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function TemplatePackagesPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <PackagesContent
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

function PackagesContent({
  templateId,
  companyId,
}: {
  templateId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const verifyTemplate = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposal_templates')
      .select('id')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/templates');
      return;
    }
    setLoading(false);
  }, [templateId, companyId, router]);

  useEffect(() => {
    verifyTemplate();
  }, [verifyTemplate]);

  if (loading) {
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
        activeTab="packages"
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
        <TemplatePackagesTab templateId={templateId} companyId={companyId} />
      </div>
    </div>
  );
}