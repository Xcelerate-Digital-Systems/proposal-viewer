// app/documents/[id]/details/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Document as DocType } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import DocumentDetailHeader from '@/components/admin/documents/DocumentDetailHeader';
import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import { useToast } from '@/components/ui/Toast';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function DocumentDetailsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <DetailsContent
          documentId={params.id}
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
  documentId,
  companyId,
}: {
  documentId: string;
  companyId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
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
    setDoc(data);
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
    fetchDocument();
    fetchCustomDomain();
  }, [fetchDocument, fetchCustomDomain]);

  if (loading || !doc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentDetailHeader
        documentId={documentId}
        activeTab="details"
        customDomain={customDomain}
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
        <EditDetailsPanel
          type="document"
          id={doc.id}
          initialValues={{
            title: doc.title,
            description: doc.description,
          }}
          onSave={() => {
            toast.success('Details saved');
            fetchDocument();
          }}
        />
      </div>
    </div>
  );
}