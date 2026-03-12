// app/proposals/[id]/cover/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import CoverEditor from '@/components/admin/proposals/CoverEditor';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ProposalCoverPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <CoverContent
          proposalId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

function CoverContent({
  proposalId,
  companyId,
}: {
  proposalId: string;
  companyId: string;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/');
      return;
    }
    setProposal(data);
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
    fetchProposal();
    fetchCustomDomain();
  }, [fetchProposal, fetchCustomDomain]);

  if (loading || !proposal) {
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
        activeTab="cover"
        customDomain={customDomain}
      />

      <div className="flex-1 px-6 lg:px-10 py-6">
        <CoverEditor proposal={proposal} />
      </div>
    </div>
  );
}