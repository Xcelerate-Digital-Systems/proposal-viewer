// app/proposals/[id]/quote-packages/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import QuoteDetailHeader from '@/components/admin/proposals/QuoteDetailHeader';
import PackagesTab from '@/components/admin/proposals/PackagesTab';

export default function QuotePackagesPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <QuotePackagesContent proposalId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function QuotePackagesContent({ proposalId, companyId }: { proposalId: string; companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const verify = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('id')
      .eq('id', proposalId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) { router.push('/'); return; }
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
    verify();
    fetchCustomDomain();
  }, [verify, fetchCustomDomain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <QuoteDetailHeader proposalId={proposalId} activeTab="quote-packages" customDomain={customDomain} />
      <div className="flex-1 min-h-0 px-6 lg:px-10 py-6 flex flex-col">
        <PackagesTab proposalId={proposalId} />
      </div>
    </div>
  );
}
