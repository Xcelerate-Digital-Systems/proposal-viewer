'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Code2, Copy, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

type Stage = 'loading' | 'domain' | 'install' | 'page';

interface WebpageItemFormProps {
  reviewProjectId: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
}

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

function stripDomain(url: string, domain: string): string {
  try {
    if (url.startsWith(domain)) {
      const rest = url.slice(domain.length);
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
  } catch { /* noop */ }
  return url;
}

export default function WebpageItemForm({
  reviewProjectId,
  onSubmit,
  onBack,
  onCancel,
  uploading,
}: WebpageItemFormProps) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('loading');
  const [project, setProject] = useState<FeedbackProject | null>(null);

  // Stage inputs
  const [domainInput, setDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState('');
  const [pagePath, setPagePath] = useState('/');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch project and decide initial stage ─────────────── */
  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', reviewProjectId)
      .single();

    if (error || !data) {
      toast.error('Failed to load project');
      return null;
    }
    setProject(data);
    return data as FeedbackProject;
  }, [reviewProjectId, toast]);

  useEffect(() => {
    (async () => {
      const data = await fetchProject();
      if (!data) return;
      if (data.script_installed_at) {
        setStage('page');
      } else if (data.root_domain) {
        setDomainInput(data.root_domain);
        setStage('install');
      } else {
        setStage('domain');
      }
    })();
  }, [fetchProject]);

  /* ── Poll for install while on the install stage ────────── */
  useEffect(() => {
    if (stage !== 'install') return;

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('review_projects')
        .select('script_installed_at')
        .eq('id', reviewProjectId)
        .single();
      if (data?.script_installed_at) {
        setProject((p) => p ? { ...p, script_installed_at: data.script_installed_at } : p);
        setStage('page');
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stage, reviewProjectId]);

  /* ── Stage 1: save root domain ──────────────────────────── */
  const handleSaveDomain = async () => {
    const domain = normaliseDomain(domainInput);
    if (!domain) {
      toast.error('Enter a valid URL, e.g. https://example.com');
      return;
    }
    setSavingDomain(true);
    const { error } = await supabase
      .from('review_projects')
      .update({ root_domain: domain, updated_at: new Date().toISOString() })
      .eq('id', reviewProjectId);

    if (error) {
      toast.error('Failed to save domain');
      setSavingDomain(false);
      return;
    }
    setProject((p) => p ? { ...p, root_domain: domain } : p);
    setDomainInput(domain);
    setStage('install');
    setSavingDomain(false);
  };

  /* ── Stage 2: install script ────────────────────────────── */
  const scriptTag = project?.share_token
    ? `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/review-widget/${project.share_token}/script" defer><\/script>`
    : '';

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

  /* ── Stage 3: add a page ────────────────────────────────── */
  const pageUrl = project?.root_domain
    ? `${project.root_domain}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`
    : pagePath;

  const canSubmitPage = !!title.trim() && !!project?.root_domain;

  const handleSubmitPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPage) return;
    await onSubmit({
      title: title.trim(),
      type: 'webpage',
      url: pageUrl,
    });
  };

  /* ── Render ─────────────────────────────────────────────── */

  if (stage === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-gray-300 animate-spin" size={24} />
      </div>
    );
  }

  if (stage === 'domain') {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); handleSaveDomain(); }}
        className="p-6 space-y-5 overflow-y-auto"
      >
        <div className="rounded-lg bg-teal/5 border border-teal/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
              <Globe size={16} className="text-teal" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">Connect your website</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                One install covers every page in this project — no need to re-paste the script for
                each page you add.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Root domain <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1.5">
            The base URL where the feedback widget will live. Subdomains and paths can be added later.
          </p>
        </div>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!normaliseDomain(domainInput) || savingDomain}
          uploading={savingDomain}
          submitLabel="Continue"
        />
      </form>
    );
  }

  if (stage === 'install') {
    return (
      <div className="p-6 space-y-5 overflow-y-auto">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
              <Code2 size={16} className="text-teal" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700">Install the script</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Paste this into the <code className="font-mono">&lt;head&gt;</code> of{' '}
                <span className="font-mono text-gray-700">{project?.root_domain}</span>. We&apos;ll
                detect it and move you to the next step automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Code2 size={13} />
              Embed Code
            </label>
            <button
              type="button"
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
              {scriptTag || '/* Missing share token */'}
            </pre>
            <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
          </span>
          <p className="text-xs font-medium text-amber-800">Waiting for install…</p>
          <a
            href={project?.root_domain || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            Open site
          </a>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStage('domain')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Change domain
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // stage === 'page'
  return (
    <form onSubmit={handleSubmitPage} className="p-6 space-y-5 overflow-y-auto">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-800 truncate">
          Connected to <span className="font-mono font-semibold">{project?.root_domain}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Page Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Initial Offer Page"
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Page Path
        </label>
        <div className="flex items-stretch rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal overflow-hidden">
          <span className="px-3 py-2.5 text-xs font-mono text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">
            {project?.root_domain}
          </span>
          <input
            type="text"
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            placeholder="/offer"
            className="flex-1 px-3 py-2.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none min-w-0"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Leave as <code className="font-mono">/</code> for the homepage.
        </p>
      </div>

      <FormActions
        onBack={onBack}
        onCancel={onCancel}
        disabled={!canSubmitPage || uploading}
        uploading={uploading}
        submitLabel="Add Page"
      />
    </form>
  );
}
