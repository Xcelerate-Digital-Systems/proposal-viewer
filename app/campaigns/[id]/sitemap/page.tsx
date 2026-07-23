'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import SitemapView from '@/components/admin/feedback/sitemap/SitemapView';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';

export default function SitemapPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <SitemapGate
          accountType={auth.accountType}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function SitemapGate({ accountType, projectId, companyId, userId }: {
  accountType?: 'agency' | 'client'; projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;
  return <SitemapContent projectId={projectId} companyId={companyId} userId={userId} />;
}

function SitemapContent({ projectId, companyId, userId }: {
  projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [projRes, itemsRes, domainRes] = await Promise.all([
      supabase.from('review_projects').select('*').eq('id', projectId).eq('company_id', companyId).single(),
      supabase.from('review_items').select('*').eq('review_project_id', projectId).eq('company_id', companyId).order('sort_order'),
      supabase.from('companies').select('custom_domain, domain_verified').eq('id', companyId).single(),
    ]);

    if (projRes.data) setProject(projRes.data as FeedbackProject);
    if (itemsRes.data) setItems(itemsRes.data as FeedbackItem[]);
    if (domainRes.data?.domain_verified && domainRes.data?.custom_domain) {
      setCustomDomain(domainRes.data.custom_domain);
    }
    setLoading(false);
  }, [projectId, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNavigateToItem = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }
    router.push(`/campaigns/${projectId}/assets/${itemId}?type=${item?.type || ''}`);
  }, [items, projectId, router]);

  if (loading || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasWebpages = items.some((i) => i.type === 'webpage');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FeedbackProjectHeader
        projectId={projectId}
        project={project}
        setProject={setProject as (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => void}
        customDomain={customDomain}
        hasWebpages={hasWebpages}
        activeTab="sitemap"
      />

      <div className="flex-1 overflow-hidden">
        <SitemapView
          projectId={projectId}
          companyId={companyId}
          userId={userId}
          items={items}
          onRefresh={fetchData}
          onNavigateToItem={handleNavigateToItem}
        />
      </div>
    </div>
  );
}
