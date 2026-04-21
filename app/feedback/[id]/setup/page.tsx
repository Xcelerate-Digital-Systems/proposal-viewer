'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Globe, Code2, Copy, Check, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewSetupPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <SetupGate
          isSuperAdmin={auth.isSuperAdmin}
          projectId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function SetupGate({ isSuperAdmin, projectId, companyId }: {
  isSuperAdmin?: boolean; projectId: string; companyId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <SetupContent projectId={projectId} companyId={companyId} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function SetupContent({ projectId, companyId }: { projectId: string; companyId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/feedback'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .eq('type', 'webpage')
      .order('sort_order', { ascending: true });

    setItems(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
  }, [fetchProject, fetchItems]);

  // Poll for install state if not yet connected
  useEffect(() => {
    if (!project || project.script_installed_at) return;
    const t = setInterval(fetchProject, 5000);
    return () => clearInterval(t);
  }, [project, fetchProject]);

  if (!project && !loading) return null;

  const installed = !!project?.script_installed_at;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          All Projects
        </Link>

        {project && (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
                  {project.title}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  {project.client_name && (
                    <span className="text-sm text-gray-400">{project.client_name}</span>
                  )}
                </div>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="setup" hasWebpages />
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : !project.root_domain ? (
          <NotStartedCard projectId={projectId} />
        ) : (
          <div className="max-w-3xl space-y-6">
            <StatusCard project={project} items={items} installed={installed} />

            {items.length > 0 && <PagesList items={items} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pre-setup empty state                                              */
/* ------------------------------------------------------------------ */

function NotStartedCard({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Globe size={28} className="text-teal" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">No website connected yet</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
        Add a webpage from the Items tab to kick off the install wizard. One script covers every page
        in this project.
      </p>
      <Link
        href={`/feedback/${projectId}/items`}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-hover transition-colors"
      >
        <Plus size={16} />
        Add a webpage
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Install status card                                                */
/* ------------------------------------------------------------------ */

function StatusCard({
  project,
  items,
  installed,
}: {
  project: FeedbackProject;
  items: FeedbackItem[];
  installed: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(!installed);

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const scriptTag = `<script src="${apiBase}/api/review-widget/${project.share_token}/script" defer><\/script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptTag);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = scriptTag;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              installed ? 'bg-emerald-50' : 'bg-amber-50'
            }`}
          >
            {installed
              ? <CheckCircle2 size={18} className="text-emerald-600" />
              : <Clock size={18} className="text-amber-600" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              {installed ? 'Script installed' : 'Waiting for install'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
              {project.root_domain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={project.root_domain || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
          >
            <ExternalLink size={12} />
            Visit
          </a>
          <button
            onClick={() => setShowEmbed((s) => !s)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
          >
            <Code2 size={12} />
            {showEmbed ? 'Hide code' : 'Show code'}
          </button>
        </div>
      </div>

      {showEmbed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Code2 size={13} />
              Embed Code
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div
            onClick={handleCopy}
            className="relative bg-gray-900 rounded-xl p-4 cursor-pointer group"
          >
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
              {scriptTag}
            </pre>
            <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
          </div>
          <p className="text-xs text-gray-400">
            Paste this into the <code className="font-mono text-gray-500">&lt;head&gt;</code> of{' '}
            <span className="font-mono text-gray-600">{project.root_domain}</span>. Works across{' '}
            {items.length} page{items.length === 1 ? '' : 's'} in this project.
          </p>
        </div>
      )}

      {!installed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
          </span>
          <p className="text-xs font-medium text-amber-800">
            Paste the script, then visit any page on {project.root_domain} — we&apos;ll auto-detect it.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-page status list                                               */
/* ------------------------------------------------------------------ */

function PagesList({ items }: { items: FeedbackItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Pages</h3>
        <span className="text-xs text-gray-400">
          {items.filter((i) => i.widget_installed_at).length}/{items.length} visited
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
            {it.widget_installed_at ? (
              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            ) : (
              <Clock size={12} className="text-amber-500 shrink-0" />
            )}
            <span className="font-medium truncate">{it.title}</span>
            {it.url && (
              <span className="text-gray-400 truncate font-mono">· {it.url}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
