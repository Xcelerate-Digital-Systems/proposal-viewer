// app/documents/[id]/contents/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import DocumentDetailHeader from '@/components/admin/documents/DocumentDetailHeader';
import TocTab from '@/components/admin/shared/TocTab';

export default function DocumentContentsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <ContentsContent
          documentId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function ContentsContent({
  documentId,
  companyId,
}: {
  documentId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const verifyDocument = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/documents');
      return;
    }
    setLoading(false);
  }, [documentId, companyId, router]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  useEffect(() => {
    verifyDocument();
    fetchCustomDomain();
  }, [verifyDocument, fetchCustomDomain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentDetailHeader
        documentId={documentId}
        activeTab="contents"
        customDomain={customDomain}
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
       <TocTab entityType="document" entityId={documentId} />
      </div>
    </div>
  );
}