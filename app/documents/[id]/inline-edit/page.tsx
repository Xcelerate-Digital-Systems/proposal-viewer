// app/documents/[id]/inline-edit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDocumentViewer from '@/components/admin/documents/AdminDocumentViewer';

export default function DocumentInlineEditPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <DocumentInlineEditContent documentId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DocumentInlineEditContent({ documentId, companyId }: { documentId: string; companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const verify = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, share_token')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) { router.push('/documents'); return; }
    setShareToken(data.share_token);
    setLoading(false);
  }, [documentId, companyId, router]);

  useEffect(() => { verify(); }, [verify]);

  if (loading || !shareToken) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminDocumentViewer
      documentId={documentId}
      shareToken={shareToken}
      onExit={() => router.push(`/documents/${documentId}/pages`)}
    />
  );
}
