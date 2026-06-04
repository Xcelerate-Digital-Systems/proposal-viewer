'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Globe, Code2, Copy, Check, CheckCircle2, Clock, ExternalLink, Power } from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { buttonClasses } from '@/components/ui/Button';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewSetupPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <SetupGate
          accountType={auth.accountType}
          projectId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function SetupGate({ accountType, projectId, companyId }: {
  accountType?: 'agency' | 'client'; projectId: string; companyId: string;
}) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

  return <SetupContent projectId={projectId} companyId={companyId} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function SetupContent({ projectId, companyId }: { projectId: string; companyId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/campaigns'); return; }
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

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchCustomDomain();
  }, [fetchProject, fetchItems, fetchCustomDomain]);

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
      {project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={project}
          setProject={setProject}
          customDomain={customDomain}
          hasWebpages
          activeTab="setup"
        />
      )}

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : !project.root_domain ? (
          <NotStartedCard projectId={projectId} />
        ) : (
          <div className="max-w-3xl space-y-6">
            <StatusCard project={project} items={items} installed={installed} />

            <WidgetEnabledToggle
              project={project}
              onChange={(next) =>
                setProject((prev) => (prev ? { ...prev, widget_enabled: next } : prev))
              }
            />

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
      <h3 className="text-lg font-semibold text-prose mb-1">No website connected yet</h3>
      <p className="text-sm text-dim mb-5 max-w-md mx-auto">
        Add a webpage from the Items tab to kick off the install wizard. One script covers every page
        in this project.
      </p>
      <Link
        href={`/campaigns/${projectId}/assets`}
        className={buttonClasses({ variant: 'primary', size: 'sm' })}
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
  const [showEmbed, setShowEmbed] = useState(true);

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const scriptSrc = `${apiBase}/api/review-widget/${project.share_token}/script`;
  const scriptTag = `<!-- AgencyViz Code -->
<script>
(function(){
  var s=document.createElement('script');s.defer=true;
  s.src=${JSON.stringify(scriptSrc)};
  document.head.appendChild(s);
})();
<\/script>
<!-- End AgencyViz Code -->`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
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
            <h3 className="text-sm font-semibold text-ink">
              {installed ? 'Script installed' : 'Waiting for install'}
            </h3>
            <p className="text-xs text-faint mt-0.5 font-mono truncate">
              {project.root_domain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={project.root_domain || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-teal hover:bg-teal/5 transition-colors"
          >
            <ExternalLink size={12} />
            Visit
          </a>
          <button
            onClick={() => setShowEmbed((s) => !s)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-teal hover:bg-teal/5 transition-colors"
          >
            <Code2 size={12} />
            {showEmbed ? 'Hide code' : 'Show code'}
          </button>
        </div>
      </div>

      {showEmbed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-dim">
              <Code2 size={13} />
              Embed Code
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-dim hover:text-teal hover:bg-teal/5 transition-colors"
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
            className="relative bg-gray-900 rounded-2xl p-4 cursor-pointer group"
          >
            <pre className="text-xs text-faint font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
              {scriptTag}
            </pre>
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
          </div>
          <p className="text-xs text-faint">
            Paste this into the <code className="font-mono text-dim">&lt;head&gt;</code> of{' '}
            <span className="font-mono text-prose">{project.root_domain}</span>. Works across{' '}
            {items.length} page{items.length === 1 ? '' : 's'} in this project.
          </p>
        </div>
      )}

      {!installed && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-amber-100">
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

/* ------------------------------------------------------------------ */
/*  Widget on/off toggle                                                */
/* ------------------------------------------------------------------ */

function WidgetEnabledToggle({
  project,
  onChange,
}: {
  project: FeedbackProject;
  onChange: (next: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  // `widget_enabled` defaults to true on the server; treat any non-false
  // as on so projects predating the column don't appear disabled.
  const enabled = project.widget_enabled !== false;

  const toggle = async () => {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    // Optimistic flip — revert if the write fails.
    onChange(next);
    const { error } = await supabase
      .from('review_projects')
      .update({ widget_enabled: next, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setSaving(false);
    if (error) {
      onChange(!next);
      console.error('widget_enabled update failed:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          enabled ? 'bg-teal/10 text-teal' : 'bg-surface text-faint'
        }`}
      >
        <Power size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink">Widget on website</h3>
        <p className="text-xs text-dim mt-0.5 leading-relaxed">
          {enabled
            ? 'The feedback toolbar is live on every embedded page. Toggle off to hide it without removing the script tag.'
            : 'The script is installed but the toolbar is hidden. Reviewers can’t leave new feedback until you switch it back on.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Disable widget' : 'Enable widget'}
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
          enabled ? 'bg-teal' : 'bg-edge-hover'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out my-0.5 ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function PagesList({ items }: { items: FeedbackItem[] }) {
  return (
    <div className="bg-white rounded-2xl border border-edge-strong p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Pages</h3>
        <span className="text-xs text-faint">{items.length} total</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-xs text-prose min-w-0">
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            <span className="font-medium truncate">{it.title}</span>
            {it.url && (
              <span className="text-faint truncate font-mono">· {it.url}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
