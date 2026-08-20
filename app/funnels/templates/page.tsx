'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trash2, Copy, ExternalLink, Bookmark, MoreHorizontal, Pencil, Plus, FileText } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import { supabase, type Funnel } from '@/lib/supabase';
import { buildFunnelUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { duplicateFunnelAsScenario } from '@/lib/funnel/duplicate-funnel';
import { createFunnelFromTemplate } from '@/lib/funnel/create-from-template';
import { FUNNEL_TEMPLATES, type FunnelTemplate } from '@/lib/funnel/templates';

type TemplateCategory = FunnelTemplate['category'] | 'all' | 'mine';

const CATEGORY_TABS: { key: TemplateCategory; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'mine',      label: 'My Templates' },
  { key: 'leadgen',   label: 'Lead Gen' },
  { key: 'sales',     label: 'Sales' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'service',   label: 'Service' },
  { key: 'course',    label: 'Course' },
];

export default function FunnelTemplatesPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <TemplatesGate
          accountType={auth.accountType}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function TemplatesGate({ accountType, companyId, userId }: { accountType?: 'agency' | 'client'; companyId: string; userId: string | null }) {
  const router = useRouter();
  const allowed = accountType === 'agency';
  useEffect(() => { if (!allowed) router.replace('/dashboard'); }, [allowed, router]);
  if (!allowed) return null;
  return <TemplatesContent companyId={companyId} userId={userId} />;
}

function TemplatesContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [customTemplates, setCustomTemplates] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('companies').select('custom_domain, domain_verified').eq('id', companyId).single()
      .then(({ data }) => { if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain); });
  }, [companyId]);

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('funnels').select('*')
        .eq('company_id', companyId)
        .eq('is_template', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setCustomTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch funnel templates:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const rename = async (id: string, name: string) => {
    const { error } = await supabase.from('funnels').update({ name }).eq('id', id);
    if (error) { toast.error('Failed to rename'); return; }
    setCustomTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
  };

  const duplicate = async (source: Funnel) => {
    const created = await duplicateFunnelAsScenario({
      source, companyId, userId,
      scenarioName: `${source.name} (Copy)`,
      parentFunnelIdOverride: null,
    });
    if (!created) { toast.error('Failed to duplicate'); return; }
    await supabase.from('funnels').update({ is_template: true }).eq('id', created.id);
    toast.success('Template duplicated');
    await load();
  };

  const createFunnelFromCustom = async (source: Funnel) => {
    const created = await duplicateFunnelAsScenario({
      source, companyId, userId,
      scenarioName: source.name.replace(/\s*\(Template\)\s*$/, ''),
      parentFunnelIdOverride: null,
    });
    if (!created) { toast.error('Failed to create funnel'); return; }
    router.push(`/funnels/${created.id}/board`);
  };

  const editBuiltInTemplate = async (template: FunnelTemplate) => {
    const created = await createFunnelFromTemplate({ template, companyId, userId });
    if (!created) { toast.error('Failed to create template'); return; }
    await supabase.from('funnels').update({ is_template: true }).eq('id', created.id);
    toast.success(`"${template.name}" saved as editable template`);
    await load();
    router.push(`/funnels/${created.id}/board`);
  };

  const createFromBuiltIn = async (template: FunnelTemplate) => {
    const created = await createFunnelFromTemplate({ template, companyId, userId });
    if (!created) { toast.error('Failed to create funnel'); return; }
    router.push(`/funnels/${created.id}/board`);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Delete template',
      message: 'Delete this funnel template? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('funnels').delete().eq('id', id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const copyShareLink = async (token: string) => {
    const url = buildFunnelUrl(token, customDomain, window.location.origin);
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  const showBuiltIn = category !== 'mine';
  const showCustom = category === 'all' || category === 'mine';

  const builtIn = !showBuiltIn
    ? []
    : category === 'all'
      ? FUNNEL_TEMPLATES
      : FUNNEL_TEMPLATES.filter((t) => t.category === category);

  const filteredBuiltIn = query
    ? builtIn.filter((t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase())
      )
    : builtIn;

  const filteredCustom = !showCustom
    ? []
    : query
      ? customTemplates.filter((t) =>
          (t.name?.toLowerCase() || '').includes(query.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(query.toLowerCase())
        )
      : customTemplates;

  const totalCount = customTemplates.length + FUNNEL_TEMPLATES.length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Funnel Templates"
        description={<>{totalCount} template{totalCount !== 1 ? 's' : ''}</>}
        actions={
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[220px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={15} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search templates..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-caption text-ink placeholder-faint outline-none w-full"
            />
          </div>
        }
      />

      <div className="flex items-center gap-1 px-6 lg:px-10 py-3 border-b border-edge overflow-x-auto">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCategory(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
              category === t.key ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {loading ? (
          <EntityListSkeleton viewMode="grid" />
        ) : fetchError ? (
          <ErrorState description={fetchError} onRetry={() => { setLoading(true); load(); }} />
        ) : (
          <div className="space-y-8">
            {/* My Templates */}
            {(showCustom && filteredCustom.length > 0) && (
              <div>
                {category === 'all' && (
                  <div className="text-2xs uppercase tracking-wider font-semibold text-muted mb-3 flex items-center gap-1.5">
                    <Bookmark size={11} className="text-teal" />
                    My templates
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredCustom.map((t) => (
                    <CustomTemplateCard
                      key={t.id}
                      template={t}
                      onEdit={() => router.push(`/funnels/${t.id}/board`)}
                      onRename={(name) => rename(t.id, name)}
                      onDuplicate={() => duplicate(t)}
                      onCreateFunnel={() => createFunnelFromCustom(t)}
                      onCopyLink={() => copyShareLink(t.share_token)}
                      onDelete={() => remove(t.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Built-in Templates */}
            {showBuiltIn && filteredBuiltIn.length > 0 && (
              <div>
                {(category === 'all' && filteredCustom.length > 0) && (
                  <div className="text-2xs uppercase tracking-wider font-semibold text-muted mb-3 flex items-center gap-1.5">
                    <FileText size={11} />
                    Built-in templates
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredBuiltIn.map((t) => (
                    <BuiltInTemplateCard
                      key={t.slug}
                      template={t}
                      onEdit={() => editBuiltInTemplate(t)}
                      onCreateFunnel={() => createFromBuiltIn(t)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredBuiltIn.length === 0 && filteredCustom.length === 0 && (
              <EmptyState
                icon={Bookmark}
                title="No matching templates"
                description={query ? 'Try a different search term.' : 'No templates in this category.'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function BuiltInTemplateCard({ template: t, onEdit, onCreateFunnel }: {
  template: FunnelTemplate;
  onEdit: () => void;
  onCreateFunnel: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative bg-white rounded-xl border border-edge hover:border-teal/50 hover:shadow-card-hover transition-all flex flex-col">
      <button onClick={onEdit} className="text-left flex-1 p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-teal" />
          </div>
          <span className="shrink-0 text-2xs font-medium border rounded-full px-2 py-0.5 text-muted bg-surface border-edge">
            Built-in
          </span>
        </div>
        <h3 className="text-sm font-semibold text-ink leading-snug mb-1">{t.name}</h3>
        <p className="text-detail text-muted line-clamp-2 mb-2 flex-1">{t.description}</p>
        <div className="flex items-center gap-2 text-2xs text-faint">
          <span>{t.steps.length} steps</span>
          <span>·</span>
          <span>{t.edges.length} connections</span>
        </div>
      </button>

      <div className="flex items-center border-t border-edge px-2 py-1.5">
        <div className="relative ml-auto">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-edge shadow-popover rounded-lg py-1 z-[70]">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Pencil size={12} className="text-muted" />
                  Save &amp; edit template
                </button>
                <button
                  onClick={() => { onCreateFunnel(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Plus size={12} className="text-muted" />
                  Create funnel from this
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomTemplateCard({
  template: t, onEdit, onRename, onDuplicate, onCreateFunnel, onCopyLink, onDelete,
}: {
  template: Funnel;
  onEdit: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onCreateFunnel: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(t.name);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== t.name) onRename(trimmed);
  };

  return (
    <div className="group relative bg-white rounded-xl border border-edge hover:border-edge-hover hover:shadow-card-hover transition-all flex flex-col">
      <button onClick={onEdit} className="text-left flex-1 p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setRenaming(false); setNameDraft(t.name); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-ink bg-transparent border-b border-teal outline-none w-full"
            />
          ) : (
            <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">{t.name}</h3>
          )}
          <span className="shrink-0 text-2xs font-medium border rounded-full px-2 py-0.5 text-teal bg-teal/5 border-teal/20">
            Saved
          </span>
        </div>
        {t.description && (
          <p className="text-detail text-muted line-clamp-2 mb-2">{t.description}</p>
        )}
        <div className="flex items-center gap-2 text-2xs text-faint">
          <span>{relativeTime(t.updated_at)}</span>
        </div>
      </button>

      <div className="flex items-center border-t border-edge px-2 py-1.5">
        <button
          onClick={onCopyLink}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
          title="Copy share link"
        >
          <Copy size={13} />
        </button>
        <a
          href={`/funnel/${t.share_token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
          title="Preview"
        >
          <ExternalLink size={13} />
        </a>
        <div className="relative ml-auto">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-edge shadow-popover rounded-lg py-1 z-[70]">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Pencil size={12} className="text-muted" />
                  Edit template
                </button>
                <button
                  onClick={() => { setRenaming(true); setNameDraft(t.name); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Pencil size={12} className="text-muted" />
                  Rename
                </button>
                <button
                  onClick={() => { onCreateFunnel(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Plus size={12} className="text-muted" />
                  Create funnel from this
                </button>
                <button
                  onClick={() => { onDuplicate(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                >
                  <Copy size={12} className="text-muted" />
                  Duplicate template
                </button>
                <div className="border-t border-edge my-1" />
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete template
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
