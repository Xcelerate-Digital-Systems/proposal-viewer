// app/reviews/[id]/setup/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Globe, Code2, Copy, Check, CheckCircle2, Clock, ExternalLink, } from 'lucide-react';
import ProjectTabs from '@/components/admin/reviews/ProjectTabs';
import { supabase, type ReviewProject, type ReviewItem } from '@/lib/supabase';
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
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/reviews'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    setItems(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
  }, [fetchProject, fetchItems]);

  const webpageItems = items.filter((i) => i.type === 'webpage');

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <Link
          href="/reviews"
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          </div>
        ) : webpageItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Globe size={28} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No web pages</h3>
            <p className="text-sm text-gray-400 mb-4">
              Add a webpage item to your project to set up the feedback widget.
            </p>
            <Link
              href={`/reviews/${projectId}/items`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors"
            >
              <Plus size={16} />
              Add Items
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Widget Installation</h2>
              <p className="text-sm text-gray-500">
                Add the feedback widget script to each webpage to enable comments, screenshots, and screen recording.
              </p>
            </div>

            {webpageItems.map((item) => (
              <WebpageSetupCard
                key={item.id}
                item={item}
                shareToken={project?.share_token || ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual webpage setup card                                      */
/* ------------------------------------------------------------------ */

function WebpageSetupCard({ item, shareToken }: { item: ReviewItem; shareToken: string }) {
  const [copied, setCopied] = useState(false);

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';

  const scriptTag = shareToken && item.id
    ? `<script src="${apiBase}/api/review-widget/${shareToken}/script?item=${item.id}" defer><\/script>`
    : '';

  const isInstalled = !!item.widget_installed_at;

  const handleCopy = async () => {
    if (!scriptTag) return;
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
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#017C87]/10 flex items-center justify-center shrink-0">
            <Globe size={18} className="text-[#017C87]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-[#017C87] truncate block transition-colors"
              >
                {item.url}
              </a>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
            isInstalled
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 size={12} />
              Connected
            </>
          ) : (
            <>
              <Clock size={12} />
              Awaiting install
            </>
          )}
        </div>
      </div>

      {/* Embed code */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Code2 size={13} />
            Embed Code
          </label>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
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
            {scriptTag || '/* Missing share token or item ID */'}
          </pre>
          <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-[#017C87]/30 transition-colors" />
        </div>
        <p className="text-xs text-gray-400">
          Add this to the <code className="font-mono text-gray-500">&lt;head&gt;</code> tag of your page.
        </p>
      </div>

      {/* Open page link */}
      {item.url && (
        <div className="pt-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#017C87] hover:text-[#015c64] transition-colors"
          >
            <ExternalLink size={12} />
            Open Page
          </a>
        </div>
      )}
    </div>
  );
}