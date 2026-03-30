// app/proposals/[id]/quote-details/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import QuoteDetailHeader from '@/components/admin/proposals/QuoteDetailHeader';
import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import PostAcceptSection from '@/components/admin/proposals/PostAcceptSection';
import Toggle from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';

export default function QuoteDetailsPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <QuoteDetailsContent proposalId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function QuoteDetailsContent({ proposalId, companyId }: { proposalId: string; companyId: string }) {
  const router = useRouter();
  const toast = useToast();
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
    if (error || !data) { router.push('/'); return; }
    setProposal(data);
    setLoading(false);
  }, [proposalId, companyId, router]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain);
  }, [companyId]);

  useEffect(() => {
    fetchProposal();
    fetchCustomDomain();
  }, [fetchProposal, fetchCustomDomain]);

  const toggleJobFields = async () => {
    if (!proposal) return;
    const newVal = !proposal.show_job_fields;
    await supabase.from('proposals').update({ show_job_fields: newVal }).eq('id', proposalId);
    setProposal((prev) => prev ? { ...prev, show_job_fields: newVal } : prev);
  };

  if (loading || !proposal) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  const jobFieldKeys = ['site_address', 'estimated_start_date', 'estimated_duration'];

  return (
    <div className="flex flex-col h-full">
      <QuoteDetailHeader proposalId={proposalId} activeTab="quote-details" customDomain={customDomain} />
      <div className="flex-1 px-6 lg:px-10 py-6 space-y-4">
        <EditDetailsPanel
          type="proposal"
          id={proposal.id}
          initialValues={{
            title: proposal.title,
            client_name: proposal.client_name,
            client_email: proposal.client_email,
            crm_identifier: proposal.crm_identifier,
            site_address: proposal.site_address,
            estimated_start_date: proposal.estimated_start_date,
            estimated_duration: proposal.estimated_duration,
            description: proposal.description,
          }}
          onSave={() => {
            toast.success('Details saved');
            fetchProposal();
          }}
          onCancel={() => {}}
          hiddenFields={proposal.show_job_fields ? [] : jobFieldKeys}
        />

        {/* Job fields toggle */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Job / Site Fields</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Show Site Address, Estimated Start Date, and Duration for this quote
              </p>
            </div>
            <Toggle enabled={proposal.show_job_fields} onChange={toggleJobFields} />
          </div>
        </div>

        <PostAcceptSection
          entityId={proposal.id}
          table="proposals"
          initialAction={proposal.post_accept_action ?? null}
          initialRedirectUrl={proposal.post_accept_redirect_url ?? null}
          initialMessage={proposal.post_accept_message ?? null}
        />
      </div>
    </div>
  );
}
