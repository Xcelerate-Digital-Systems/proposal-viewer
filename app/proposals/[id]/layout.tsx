// app/proposals/[id]/layout.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import QuoteDetailHeader from '@/components/admin/proposals/QuoteDetailHeader';
import { ProposalDetailProvider } from '@/components/admin/proposals/ProposalDetailContext';
import { EditorSaveStatusProvider } from '@/components/admin/EditorSaveStatusContext';

export default function ProposalDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
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
  const pathname = usePathname();
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
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  // Decide which header to show based on the current tab segment.
  // /proposals/[id]/quote-* → quote header; otherwise → proposal header.
  const tabSegment = (pathname?.split('/').filter(Boolean)[2] ?? '');
  const isQuoteTab = tabSegment.startsWith('quote-');

  return (
    <ProposalDetailProvider
      value={{
        proposal,
        refetch: fetchProposal,
        companyId,
        customDomain,
        companyBgPrimary,
      }}
    >
      <EditorSaveStatusProvider>
        <div className="flex flex-col h-full">
          {isQuoteTab ? (
            <QuoteDetailHeader
              proposal={proposal}
              customDomain={customDomain}
              onProposalChange={(next) => setProposal(next)}
            />
          ) : (
            <ProposalDetailHeader
              proposal={proposal}
              customDomain={customDomain}
              onProposalChange={(next) => setProposal(next)}
            />
          )}
          {children}
        </div>
      </EditorSaveStatusProvider>
    </ProposalDetailProvider>
  );
}
