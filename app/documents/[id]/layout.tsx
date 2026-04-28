// app/documents/[id]/layout.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Document as DocType } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import DocumentDetailHeader from '@/components/admin/documents/DocumentDetailHeader';
import { DocumentDetailProvider } from '@/components/admin/documents/DocumentDetailContext';
import { EditorSaveStatusProvider } from '@/components/admin/EditorSaveStatusContext';

export default function DocumentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <AdminLayout>
      {(auth) => (
        <DetailShell documentId={params.id} companyId={auth.companyId ?? ''}>
          {children}
        </DetailShell>
      )}
    </AdminLayout>
  );
}

function DetailShell({
  documentId,
  companyId,
  children,
}: {
  documentId: string;
  companyId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

  const fetchDocument = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/documents');
      return;
    }
    setDocument(data);
    setLoading(false);
  }, [documentId, companyId, router]);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified, bg_primary')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    } else {
      setCustomDomain(null);
    }
    if (data?.bg_primary) {
      setCompanyBgPrimary(data.bg_primary);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDocument();
    fetchCompany();
  }, [fetchDocument, fetchCompany]);

  if (loading || !document) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DocumentDetailProvider
      value={{
        document,
        refetch: fetchDocument,
        companyId,
        customDomain,
        companyBgPrimary,
      }}
    >
      <EditorSaveStatusProvider>
        <div className="flex flex-col h-full">
          <DocumentDetailHeader document={document} customDomain={customDomain} />
          {children}
        </div>
      </EditorSaveStatusProvider>
    </DocumentDetailProvider>
  );
}
