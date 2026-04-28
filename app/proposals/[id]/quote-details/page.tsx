// app/proposals/[id]/quote-details/page.tsx
'use client';

import EditDetailsPanel from '@/components/admin/shared/EditDetailsPanel';
import PostAcceptSection from '@/components/admin/proposals/PostAcceptSection';
import { useToast } from '@/components/ui/Toast';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteDetailsPage() {
  const { proposal, refetch } = useProposalDetail();
  const toast = useToast();

  return (
    <div className="flex-1 px-6 lg:px-10 py-6 space-y-4">
      <EditDetailsPanel
        type="proposal"
        id={proposal.id}
        initialValues={{
          title: proposal.title,
          client_name: proposal.client_name,
          client_email: proposal.client_email,
          crm_identifier: proposal.crm_identifier,
          description: proposal.description,
        }}
        onSave={() => {
          toast.success('Details saved');
          refetch();
        }}
        onCancel={() => {}}
        hiddenFields={['site_address', 'estimated_start_date', 'estimated_duration']}
      />
      <PostAcceptSection
        entityId={proposal.id}
        table="proposals"
        initialAction={proposal.post_accept_action ?? null}
        initialRedirectUrl={proposal.post_accept_redirect_url ?? null}
        initialMessage={proposal.post_accept_message ?? null}
      />
    </div>
  );
}
