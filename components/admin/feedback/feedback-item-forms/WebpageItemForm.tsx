'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import FormActions from './FormActions';

interface WebpageItemFormProps {
  reviewProjectId: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
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
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<FeedbackProject | null>(null);

  const [title, setTitle] = useState('');
  const [pagePath, setPagePath] = useState('/');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('review_projects')
        .select('*')
        .eq('id', reviewProjectId)
        .single();

      if (error || !data) {
        toast.error('Failed to load campaign');
        return;
      }

      // If domain not set or script not installed, send to Setup first
      if (!data.root_domain || !data.script_installed_at) {
        onCancel();
        router.push(`/campaigns/${reviewProjectId}/setup`);
        return;
      }

      setProject(data);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewProjectId]);

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

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-faint animate-spin" size={24} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitPage} className="p-6 space-y-5 overflow-y-auto">
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-800 truncate">
          Connected to <span className="font-mono font-semibold">{project?.root_domain}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-prose mb-1.5">
          Page Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Initial Offer Page"
          className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20  transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-prose mb-1.5">
          Page Path
        </label>
        <div className="flex items-stretch rounded-lg border border-edge-strong focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal overflow-hidden">
          <span className="px-2.5 py-2.5 text-sm font-mono text-faint bg-surface border-r border-edge-strong shrink-0">
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
            className="flex-1 px-3 py-2.5 text-sm text-ink font-mono placeholder:text-faint focus:outline-none min-w-0"
          />
        </div>
        <p className="text-xs text-faint mt-1.5 break-all">
          Full URL: <code className="font-mono text-dim">{project?.root_domain}{pagePath || '/'}</code>
          <span className="text-faint"> · Leave blank for the homepage.</span>
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
