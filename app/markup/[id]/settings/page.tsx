'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import ProjectAssigneesPanel from '@/components/admin/feedback/ProjectAssigneesPanel';
import { supabase, type FeedbackProject } from '@/lib/supabase';

export default function FeedbackProjectSettingsPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <SettingsContent
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function SettingsContent({
  projectId,
  companyId,
  userId,
}: {
  projectId: string;
  companyId: string;
  userId: string | null;
}) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [hasWebpages, setHasWebpages] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    const [{ data: p }, { data: items }] = await Promise.all([
      supabase
        .from('review_projects')
        .select('*')
        .eq('id', projectId)
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('review_items')
        .select('id')
        .eq('review_project_id', projectId)
        .eq('type', 'webpage')
        .limit(1),
    ]);

    if (!p) {
      router.push('/markup');
      return;
    }
    setProject(p);
    setHasWebpages((items?.length ?? 0) > 0);
    setLoading(false);
  }, [projectId, companyId, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white px-6 lg:px-10 pt-5">
        {project && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <Link
                  href="/markup"
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  title="All Projects"
                >
                  <ArrowLeft size={16} />
                </Link>
                <div className="min-w-0">
                  <h1 className="text-[17px] font-semibold tracking-tight text-ink font-[family-name:var(--font-display)] truncate">
                    {project.title}
                  </h1>
                  {project.client_name && (
                    <p className="text-xs text-gray-400 truncate">{project.client_name}</p>
                  )}
                </div>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="settings" hasWebpages={hasWebpages} />
          </>
        )}
      </div>

      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-2xl">
            <ProjectAssigneesPanel
              projectId={projectId}
              companyId={companyId}
              currentUserId={userId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
