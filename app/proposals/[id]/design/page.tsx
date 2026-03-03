// app/proposals/[id]/design/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import ProposalDetailHeader from '@/components/admin/proposals/ProposalDetailHeader';
import DesignTab from '@/components/admin/shared/DesignTab';

export default function ProposalDesignPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <DesignContent proposalId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DesignContent({ proposalId, companyId }: { proposalId: string; companyId: string }) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

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

  const fetchCompany = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified, bg_primary')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
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
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProposalDetailHeader
        proposalId={proposalId}
        activeTab="design"
        customDomain={customDomain}
      />
      <div className="flex-1 px-6 lg:px-10 py-6">
        <DesignTab
          type="proposal"
          entityId={proposalId}
          companyId={companyId}
          initialBgImagePath={proposal.bg_image_path}
          initialBgImageOverlayOpacity={proposal.bg_image_overlay_opacity}
          companyBgPrimary={companyBgPrimary}
          onSave={fetchProposal}
        />
      </div>
    </div>
  );
}