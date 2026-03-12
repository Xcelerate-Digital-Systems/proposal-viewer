// app/proposals/[id]/contents/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import TocTab from '@/components/admin/shared/TocTab';

export default function ProposalContentsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <ContentsContent
          proposalId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function ContentsContent({
  proposalId,
  companyId,
}: {
  proposalId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
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
    setExists(true);
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

  if (loading || !exists) {
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
        activeTab="contents"
        customDomain={customDomain}
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
       <TocTab entityType="proposal" entityId={proposalId} />
      </div>
    </div>
  );
}