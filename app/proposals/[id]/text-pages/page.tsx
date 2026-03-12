// app/proposals/[id]/text-pages/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import TextPagesTab from '@/components/admin/proposals/TextPagesTab';

export default function ProposalTextPagesPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <TextPagesContent
          proposalId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function TextPagesContent({
  proposalId,
  companyId,
}: {
  proposalId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const verifyProposal = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('id')
      .eq('id', proposalId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/');
      return;
    }
    setLoading(false);
  }, [proposalId, companyId, router]);

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
    verifyProposal();
    fetchCustomDomain();
  }, [verifyProposal, fetchCustomDomain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProposalDetailHeader
        proposalId={proposalId}
        activeTab="text-pages"
        customDomain={customDomain}
      />

      <div className="flex-1 px-6 lg:px-10 py-6 overflow-y-auto">
        <TextPagesTab proposalId={proposalId} companyId={companyId} />
      </div>
    </div>
  );
}