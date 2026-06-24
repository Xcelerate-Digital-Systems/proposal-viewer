'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe, Code2, Copy, Check, CheckCircle2, Clock, ExternalLink, Power,
  Loader2, AlertCircle,
} from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';

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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normaliseDomain(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    return null;
  }
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
    if (!project.root_domain) return;
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

      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading || !project ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <InstallStep
              project={project}
              onDomainSaved={(domain) =>
                setProject((prev) => prev ? { ...prev, root_domain: domain } : prev)
              }
            />

            <VerifyStep
              project={project}
              projectId={projectId}
              onVerified={() =>
                setProject((prev) =>
                  prev ? { ...prev, script_installed_at: new Date().toISOString() } : prev
                )
              }
            />

            {installed && (
              <WidgetEnabledToggle
                project={project}
                onChange={(next) =>
                  setProject((prev) => (prev ? { ...prev, widget_enabled: next } : prev))
                }
              />
            )}

            {items.length > 0 && <PagesList items={items} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: Install                                                    */
/* ------------------------------------------------------------------ */

function InstallStep({
  project,
  onDomainSaved,
}: {
  project: FeedbackProject;
  onDomainSaved: (domain: string) => void;
}) {
  const [domainInput, setDomainInput] = useState(project.root_domain || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(!project.root_domain);
  const [domainError, setDomainError] = useState('');

  const hasDomain = !!project.root_domain;
  const installed = !!project.script_installed_at;

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

  const handleSaveDomain = async () => {
    const domain = normaliseDomain(domainInput);
    if (!domain) {
      setDomainError('Enter a valid URL, e.g. https://example.com');
      return;
    }
    setDomainError('');
    setSaving(true);
    const { error } = await supabase
      .from('review_projects')
      .update({ root_domain: domain, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setSaving(false);

    if (error) {
      setDomainError('Failed to save domain');
      return;
    }
    setDomainInput(domain);
    onDomainSaved(domain);
    setShowEmbed(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-edge">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          hasDomain ? 'bg-emerald-100 text-emerald-700' : 'bg-teal/10 text-teal'
        }`}>
          {hasDomain ? <Check size={14} /> : '1'}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Install embed code</h3>
          <p className="text-xs text-faint">
            Add your website domain and paste the script into your site&apos;s <code className="font-mono text-dim">&lt;head&gt;</code> tag.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Domain input */}
        <div>
          <label className="block text-xs font-medium text-prose mb-1.5">
            Root domain
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="url"
              value={domainInput}
              onChange={(e) => { setDomainInput(e.target.value); setDomainError(''); }}
              placeholder="https://example.com"
              disabled={installed}
              className="flex-1 px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors disabled:opacity-60"
            />
            {!hasDomain && (
              <Button
                size="sm"
                onClick={handleSaveDomain}
                loading={saving}
                disabled={!domainInput.trim()}
              >
                Save
              </Button>
            )}
            {hasDomain && !installed && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDomain}
                loading={saving}
                disabled={domainInput === project.root_domain}
              >
                Update
              </Button>
            )}
          </div>
          {domainError && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> {domainError}
            </p>
          )}
          <p className="text-xs text-faint mt-1.5">
            One install covers every page in this project — no need to re-paste the script for each page you add.
          </p>
        </div>

        {/* Embed code block */}
        {hasDomain && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowEmbed((s) => !s)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-dim hover:text-teal transition-colors"
              >
                <Code2 size={13} />
                {showEmbed ? 'Hide embed code' : 'Show embed code'}
              </button>
              {showEmbed && (
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
              )}
            </div>
            {showEmbed && (
              <div
                onClick={handleCopy}
                className="relative bg-gray-900 rounded-2xl p-4 cursor-pointer group"
              >
                <pre className="text-xs text-faint font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
                  {scriptTag}
                </pre>
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: Verify                                                     */
/* ------------------------------------------------------------------ */

function VerifyStep({
  project,
  projectId,
  onVerified,
}: {
  project: FeedbackProject;
  projectId: string;
  onVerified: () => void;
}) {
  const hasDomain = !!project.root_domain;
  const installed = !!project.script_installed_at;

  const [verifyUrl, setVerifyUrl] = useState(project.root_domain || '');
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  // Keep verifyUrl in sync if domain changes
  useEffect(() => {
    if (project.root_domain && !verifyUrl) {
      setVerifyUrl(project.root_domain);
    }
  }, [project.root_domain, verifyUrl]);

  // Auto-detect via polling is already running in the parent — this just
  // provides a manual "check now" option plus the verification URL field.
  const handleVerify = async () => {
    setChecking(true);
    setCheckFailed(false);

    // Re-fetch project to see if heartbeat has been received
    const { data } = await supabase
      .from('review_projects')
      .select('script_installed_at')
      .eq('id', projectId)
      .single();

    if (data?.script_installed_at) {
      onVerified();
      setChecking(false);
      return;
    }

    // Not detected yet — show guidance
    setCheckFailed(true);
    setChecking(false);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${
      hasDomain ? 'opacity-100' : 'opacity-50 pointer-events-none'
    }`}>
      {/* Step header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-edge">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          installed ? 'bg-emerald-100 text-emerald-700' : 'bg-teal/10 text-teal'
        }`}>
          {installed ? <Check size={14} /> : '2'}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Verify installation</h3>
          <p className="text-xs text-faint">
            Visit any page on your site where the script is installed — we&apos;ll auto-detect it.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {installed ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Script verified</p>
              <p className="text-xs text-emerald-700">
                The feedback widget is active on <span className="font-mono font-semibold">{project.root_domain}</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Verification URL */}
            <div>
              <label className="block text-xs font-medium text-prose mb-1.5">
                Verification URL
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  type="url"
                  value={verifyUrl}
                  onChange={(e) => setVerifyUrl(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="flex-1 px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
                />
                {normaliseUrl(verifyUrl) && (
                  <a
                    href={normaliseUrl(verifyUrl) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium text-dim hover:text-teal hover:bg-teal/5 border border-edge-strong transition-colors"
                  >
                    <ExternalLink size={13} />
                    Visit
                  </a>
                )}
              </div>
              <p className="text-xs text-faint mt-1.5">
                Enter the full URL of any page where the script is installed. This can be a landing page, not just the root domain.
              </p>
            </div>

            {/* Verify button */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleVerify}
                loading={checking}
                leftIcon={checking ? undefined : Globe}
              >
                Verify Installation
              </Button>

              {/* Polling indicator */}
              <div className="flex items-center gap-2">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
                </span>
                <p className="text-xs text-faint">Auto-detecting…</p>
              </div>
            </div>

            {checkFailed && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-2xl bg-amber-50 border border-amber-200">
                <Clock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-medium">Script not detected yet</p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                    <li>Make sure the embed code is in the <code className="font-mono">&lt;head&gt;</code> of your page</li>
                    <li>Visit the page in your browser to trigger the script</li>
                    <li>If using a tag manager, check the tag is published and firing</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
  const enabled = project.widget_enabled !== false;

  const toggle = async () => {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
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
            : 'The script is installed but the toolbar is hidden. Reviewers can\'t leave new feedback until you switch it back on.'}
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

/* ------------------------------------------------------------------ */
/*  Pages list                                                         */
/* ------------------------------------------------------------------ */

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
