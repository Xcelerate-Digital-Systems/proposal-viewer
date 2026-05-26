// app/quotes/[id]/layout.tsx
// Mirrors /proposals/[id]/layout but always renders the quote-specific
// QuoteShellHeader and forces 404→redirect for non-quote rows.
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import QuoteShellHeader from '@/components/admin/quotes/QuoteShellHeader';
import MissingInfoBanner from '@/components/admin/quotes/MissingInfoBanner';
import { ProposalDetailProvider } from '@/components/admin/proposals/ProposalDetailContext';
import { EditorSaveStatusProvider } from '@/components/admin/EditorSaveStatusContext';

export default function QuoteDetailLayout(
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
        <DetailShell quoteId={params.id} companyId={auth.companyId ?? ''}>
          {children}
        </DetailShell>
      )}
    </AdminLayout>
  );
}

function DetailShell({
  quoteId,
  companyId,
  children,
}: {
  quoteId: string;
  companyId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');
  const [companyInfo, setCompanyInfo] = useState<{
    name: string;
    phone: string | null;
    contactEmail: string | null;
    abn: string | null;
    logoPath: string | null;
    quoteNumberPrefix: string;
    quoteNumberPadWidth: number;
  } | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/quotes');
      return;
    }
    // If someone hits /quotes/<id> for a non-quote row, bounce to proposals.
    if (data.entity_type !== 'quote') {
      router.push(`/proposals/${data.id}/pages`);
      return;
    }
    setProposal(data);
    setLoading(false);
  }, [quoteId, companyId, router]);

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('name, phone, contact_email, abn, logo_path, custom_domain, domain_verified, bg_primary, quote_number_prefix, quote_number_pad_width')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain);
    else setCustomDomain(null);
    if (data?.bg_primary) setCompanyBgPrimary(data.bg_primary);
    if (data) {
      setCompanyInfo({
        name: (data.name as string) ?? '',
        phone: (data.phone as string) ?? null,
        contactEmail: (data.contact_email as string) ?? null,
        abn: (data.abn as string) ?? null,
        logoPath: (data.logo_path as string) ?? null,
        quoteNumberPrefix: (data.quote_number_prefix as string) ?? 'Q-',
        quoteNumberPadWidth: (data.quote_number_pad_width as number) ?? 3,
      });
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

  return (
    <ProposalDetailProvider
      value={{ proposal, refetch: fetchProposal, companyId, customDomain, companyBgPrimary, companyInfo }}
    >
      <EditorSaveStatusProvider>
        <div className="flex flex-col h-full">
          <QuoteShellHeader
            proposal={proposal}
            customDomain={customDomain}
            onProposalChange={(next) => setProposal(next)}
          />
          <MissingInfoBanner companyInfo={companyInfo} />
          {children}
        </div>
      </EditorSaveStatusProvider>
    </ProposalDetailProvider>
  );
}
