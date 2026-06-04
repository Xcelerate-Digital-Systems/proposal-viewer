// app/proposals/[id]/layout.tsx
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import { ProposalDetailProvider } from '@/components/admin/proposals/ProposalDetailContext';
import { EditorSaveStatusProvider } from '@/components/admin/EditorSaveStatusContext';
import { EditorUndoProvider } from '@/components/admin/EditorUndoContext';

export default function ProposalDetailLayout(
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
        <DetailShell proposalId={params.id} companyId={auth.companyId ?? ''}>
          {children}
        </DetailShell>
      )}
    </AdminLayout>
  );
}

function DetailShell({
  proposalId,
  companyId,
  children,
}: {
  proposalId: string;
  companyId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

  const fetchProposal = useCallback(async () => {
    if (!companyId) return;
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
    // Quotes now live in their own /quotes area — bounce anyone who lands
    // on /proposals/[id] for a quote-typed row.
    if (data.entity_type === 'quote') {
      router.replace(`/quotes/${data.id}`);
      return;
    }
    setProposal(data);
    setLoading(false);
  }, [proposalId, companyId, router]);

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
    fetchProposal();
    fetchCompany();
  }, [fetchProposal, fetchCompany]);

  if (loading || !proposal) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProposalDetailProvider
      value={{
        proposal,
        refetch: fetchProposal,
        companyId,
        customDomain,
        companyBgPrimary,
        companyInfo: null,
      }}
    >
      <EditorSaveStatusProvider>
        <EditorUndoProvider>
          <div className="flex flex-col h-full">
            <ProposalDetailHeader
              proposal={proposal}
              customDomain={customDomain}
              onProposalChange={(next) => setProposal(next)}
            />
            {children}
          </div>
        </EditorUndoProvider>
      </EditorSaveStatusProvider>
    </ProposalDetailProvider>
  );
}
