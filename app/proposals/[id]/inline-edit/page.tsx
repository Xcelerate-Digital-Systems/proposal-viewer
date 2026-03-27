// app/proposals/[id]/inline-edit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminProposalViewer from '@/components/admin/proposals/AdminProposalViewer';

export default function InlineEditPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <InlineEditContent proposalId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function InlineEditContent({ proposalId, companyId }: { proposalId: string; companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isQuote, setIsQuote] = useState(false);

  const verify = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('id, share_token, entity_type')
      .eq('id', proposalId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) { router.push('/'); return; }
    setShareToken(data.share_token);
    setIsQuote(data.entity_type === 'quote');
    setLoading(false);
  }, [proposalId, companyId, router]);

  useEffect(() => {
    verify();
  }, [verify]);

  if (loading || !shareToken) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminProposalViewer
      proposalId={proposalId}
      shareToken={shareToken}
      onExit={() => router.push(`/proposals/${proposalId}/${isQuote ? 'quote-pricing' : 'pages'}`)}
    />
  );
}
