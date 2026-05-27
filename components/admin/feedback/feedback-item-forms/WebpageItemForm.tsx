'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

type Stage = 'loading' | 'domain' | 'page';

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

export default function WebpageItemForm({
  reviewProjectId,
  onSubmit,
  onBack,
  onCancel,
  uploading,
}: WebpageItemFormProps) {
  const toast = useToast();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('loading');
  const [project, setProject] = useState<FeedbackProject | null>(null);

  // Stage inputs
  const [domainInput, setDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  const [title, setTitle] = useState('');
  const [pagePath, setPagePath] = useState('/');

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
        // Domain already set but script not yet detected — send them to the
        // setup page which shows the snippet and polls for install.
        onCancel();
        router.push(`/markup/${reviewProjectId}/setup`);
      } else {
        setStage('domain');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProject]);

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

    if (project?.script_installed_at) {
      setStage('page');
      setSavingDomain(false);
    } else {
      onCancel();
      router.push(`/markup/${reviewProjectId}/setup`);
    }
  };

  /* ── Stage 2: add a page ────────────────────────────────── */
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
            className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20  transition-colors"
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
          className="w-full px-3.5 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20  transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Page Path
        </label>
        <div className="flex items-stretch rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal overflow-hidden">
          <span className="px-2.5 py-2.5 text-sm font-mono text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">
            /
          </span>
          <input
            type="text"
            value={pagePath.replace(/^\//, '')}
            onChange={(e) => {
              const v = e.target.value.replace(/^\/+/, '');
              setPagePath(v ? `/${v}` : '/');
            }}
            placeholder="offer"
            className="flex-1 px-3 py-2.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none min-w-0"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5 break-all">
          Full URL: <code className="font-mono text-gray-500">{project?.root_domain}{pagePath || '/'}</code>
          <span className="text-gray-400"> · Leave blank for the homepage.</span>
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
