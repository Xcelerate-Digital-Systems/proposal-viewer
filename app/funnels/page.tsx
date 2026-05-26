'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Workflow, Search, Trash2, Copy, ExternalLink, FileText, GitBranch, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { supabase, type Funnel } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { FUNNEL_TEMPLATES, type FunnelTemplate } from '@/lib/funnel/templates';
import { createFunnelFromTemplate } from '@/lib/funnel/create-from-template';
import { duplicateFunnelAsScenario } from '@/lib/funnel/duplicate-funnel';

export default function FunnelsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <FunnelsGate
          accountType={auth.accountType}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

// Funnels is an agency-side tool — every member of an agency workspace can
// use it. Client workspaces don't have funnels, so we bounce them back to
// the dashboard. The previous super-admin-only gate was a leftover from
// the alpha and broke navigation for users joined to a second agency.
function FunnelsGate({ accountType, companyId, userId }: { accountType?: 'agency' | 'client'; companyId: string; userId: string | null }) {
  const router = useRouter();
  const allowed = accountType === 'agency';
  useEffect(() => { if (!allowed) router.replace('/dashboard'); }, [allowed, router]);
  if (!allowed) return null;
  return <FunnelsContent companyId={companyId} userId={userId} />;
}

function FunnelsContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('funnels').select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setFunnels(data || []);
    } catch (err) {
      console.error('Failed to fetch funnels:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load funnels');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const create = async (name: string, description: string) => {
    const { data, error } = await supabase
      .from('funnels')
      .insert({ company_id: companyId, name, description: description || null, created_by: userId })
      .select().single();
    if (error || !data) { toast.error('Failed to create funnel'); return; }
    router.push(`/funnels/${data.id}/board`);
  };

  const createFromTemplate = async (template: FunnelTemplate) => {
    const created = await createFunnelFromTemplate({ template, companyId, userId });
    if (!created) { toast.error('Failed to create funnel'); return; }
    router.push(`/funnels/${created.id}/board`);
  };

  const createFromCustomTemplate = async (template: Funnel) => {
    const created = await duplicateFunnelAsScenario({
      source: template,
      companyId, userId,
      scenarioName: template.name.replace(/\s*\(Template\)\s*$/, ''),
      parentFunnelIdOverride: null,
    });
    if (!created) { toast.error('Failed to create funnel'); return; }
    router.push(`/funnels/${created.id}/board`);
  };

  const duplicateAsScenario = async (source: Funnel) => {
    const created = await duplicateFunnelAsScenario({ source, companyId, userId });
    if (!created) { toast.error('Failed to duplicate funnel'); return; }
    toast.success('Scenario created');
    await load();
    router.push(`/funnels/${created.id}/board`);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this funnel? All steps and connections will be removed.')) return;
    await supabase.from('funnels').delete().eq('id', id);
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/funnel/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  };

  // Hide custom templates from the main list — they live in the gallery.
  const liveFunnels = funnels.filter((f) => !f.is_template);
  const customTemplates = funnels.filter((f) => f.is_template);
  const filtered = query
    ? liveFunnels.filter((f) =>
        (f.name?.toLowerCase() || '').includes(query.toLowerCase()) ||
        (f.description?.toLowerCase() || '').includes(query.toLowerCase())
      )
    : liveFunnels;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-ivory px-6 lg:px-10 py-6 shadow-divider">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Funnel Planner</h1>
            <p className="text-sm text-muted mt-1">
              {liveFunnels.length} funnel{liveFunnels.length !== 1 ? 's' : ''}
              {customTemplates.length > 0 && ` · ${customTemplates.length} template${customTemplates.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[220px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={15} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search funnels..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowCreate(true)}
            >
              New Funnel
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showCreate && (
          <CreateFunnelModal
            onClose={() => setShowCreate(false)}
            onCreate={create}
            onCreateFromTemplate={createFromTemplate}
            customTemplates={customTemplates}
            onCreateFromCustomTemplate={createFromCustomTemplate}
          />
        )}

        {loading ? (
          <EntityListSkeleton viewMode="grid" />
        ) : fetchError ? (
          <ErrorState
            description={fetchError}
            onRetry={() => { setLoading(true); load(); }}
          />
        ) : funnels.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No funnels yet"
            description="Create a funnel to map out a client's journey visually."
            action={
              <Button size="sm" leftIcon={Plus} onClick={() => setShowCreate(true)}>
                New Funnel
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((f) => (
              <div key={f.id} className="group bg-white rounded-xl border border-edge p-4 hover:shadow-md transition-shadow flex flex-col">
                <button
                  onClick={() => router.push(`/funnels/${f.id}/board`)}
                  className="text-left flex-1"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                      <Workflow size={18} className="text-teal" />
                    </div>
                    {f.parent_funnel_id && (
                      <span className="inline-flex items-center gap-1 text-2xs text-muted bg-surface border border-edge rounded-full px-2 py-0.5">
                        <GitBranch size={10} />
                        Scenario
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-ink truncate">{f.name}</h3>
                  {f.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{f.description}</p>
                  )}
                  <p className="text-[11px] text-faint mt-3">
                    Updated {new Date(f.updated_at).toLocaleDateString()}
                  </p>
                </button>
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-edge">
                  <button
                    onClick={() => copyShareLink(f.share_token)}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors"
                    title="Copy share link"
                  >
                    <Copy size={11} />
                    Share
                  </button>
                  <a
                    href={`/funnel/${f.share_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors"
                    title="Open public view"
                  >
                    <ExternalLink size={11} />
                    View
                  </a>
                  <button
                    onClick={() => duplicateAsScenario(f)}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors"
                    title="Duplicate as scenario (compare 'what if' variations)"
                  >
                    <GitBranch size={11} />
                    Scenario
                  </button>
                  <button
                    onClick={() => remove(f.id)}
                    className="ml-auto flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                    title="Delete funnel"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type TemplateCategory = FunnelTemplate['category'] | 'all';
const TEMPLATE_TABS: { key: TemplateCategory; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'leadgen',   label: 'Lead Gen' },
  { key: 'sales',     label: 'Sales' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'service',   label: 'Service' },
  { key: 'course',    label: 'Course' },
];

function CreateFunnelModal({
  onClose, onCreate, onCreateFromTemplate, customTemplates, onCreateFromCustomTemplate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
  onCreateFromTemplate: (template: FunnelTemplate) => Promise<void>;
  customTemplates: Funnel[];
  onCreateFromCustomTemplate: (template: Funnel) => Promise<void>;
}) {
  const [step, setStep] = useState<'pick' | 'blank'>('pick');
  const [tab, setTab] = useState<TemplateCategory>('all');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const templates = tab === 'all' ? FUNNEL_TEMPLATES : FUNNEL_TEMPLATES.filter((t) => t.category === tab);
  // Custom templates ignore the category tabs — they're always shown when the
  // user is on "All". Easiest model and lines up with how the user thinks of
  // their own templates (uncategorised personal library).
  const showCustomTemplates = tab === 'all' && customTemplates.length > 0;

  const submitBlank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    await onCreate(name.trim(), description.trim());
  };

  const pickTemplate = async (t: FunnelTemplate) => {
    if (submitting) return;
    setSubmitting(true);
    await onCreateFromTemplate(t);
  };

  const pickCustomTemplate = async (t: Funnel) => {
    if (submitting) return;
    setSubmitting(true);
    await onCreateFromCustomTemplate(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-edge shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-edge">
          <div>
            <h2 className="text-base font-semibold text-ink">New funnel</h2>
            <p className="text-xs text-muted mt-0.5">
              {step === 'pick' ? 'Start from a template or build from scratch.' : 'Build from a blank canvas.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors"
            title="Close"
          >
            ×
          </button>
        </div>

        {step === 'pick' ? (
          <>
            <div className="flex items-center gap-1 px-5 py-3 border-b border-edge overflow-x-auto">
              {TEMPLATE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    tab === t.key ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {showCustomTemplates && (
                <div>
                  <div className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2 flex items-center gap-1.5">
                    <Bookmark size={11} className="text-teal" />
                    My templates
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {customTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => pickCustomTemplate(t)}
                        disabled={submitting}
                        className="text-left bg-white rounded-xl border border-edge p-4 hover:border-teal/50 hover:shadow-md transition-all disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center mb-3">
                          <Bookmark size={16} className="text-teal" />
                        </div>
                        <div className="text-[13px] font-semibold text-ink truncate">{t.name}</div>
                        {t.description && (
                          <div className="text-[11px] text-muted mt-0.5 line-clamp-2">{t.description}</div>
                        )}
                        <div className="text-2xs text-faint mt-2">
                          Saved {new Date(t.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                {showCustomTemplates && (
                  <div className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2 flex items-center gap-1.5">
                    <FileText size={11} />
                    Built-in templates
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    onClick={() => setStep('blank')}
                    disabled={submitting}
                    className="text-left bg-white rounded-xl border-2 border-dashed border-edge p-4 hover:border-teal hover:bg-teal/5 transition-colors disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center mb-3">
                      <Plus size={16} className="text-muted" />
                    </div>
                    <div className="text-[13px] font-semibold text-ink">Blank canvas</div>
                    <div className="text-[11px] text-muted mt-0.5">Start from an empty board.</div>
                  </button>

                  {templates.map((t) => (
                    <button
                      key={t.slug}
                      onClick={() => pickTemplate(t)}
                      disabled={submitting}
                      className="text-left bg-white rounded-xl border border-edge p-4 hover:border-teal/50 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center mb-3">
                        <FileText size={16} className="text-teal" />
                      </div>
                      <div className="text-[13px] font-semibold text-ink">{t.name}</div>
                      <div className="text-[11px] text-muted mt-0.5 line-clamp-2">{t.description}</div>
                      <div className="text-2xs text-faint mt-2">
                        {t.steps.length} steps · {t.edges.length} connections
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={submitBlank} className="p-5">
            <label className="block text-[11px] text-muted mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Magnet → Tripwire → Core Offer"
              className="w-full px-3 py-2 rounded-lg border border-edge text-sm outline-none focus:border-teal mb-3"
            />
            <label className="block text-[11px] text-muted mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this funnel is for…"
              className="w-full px-3 py-2 rounded-lg border border-edge text-sm outline-none focus:border-teal resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setStep('pick')} className="px-3 py-1.5 rounded-full text-sm text-muted hover:text-ink hover:bg-surface transition-colors">
                ← Templates
              </button>
              <Button
                type="submit"
                size="sm"
                loading={submitting}
                disabled={!name.trim()}
              >
                Create
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
