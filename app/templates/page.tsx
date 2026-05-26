// app/templates/page.tsx
// Templates index — three tabs:
//   • Proposals   → proposal_templates where entity_type = 'proposal'
//   • Quotes      → proposal_templates where entity_type = 'quote'
//   • Line items  → line_item_templates (saved item sets used by the quote
//                   builder's "From Library" button)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Upload, LayoutGrid, List, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import TemplateUploadModal from '@/components/admin/templates/TemplateUploadModal';
import TemplateListCard from '@/components/admin/templates/TemplateListCard';
import TemplateListRow from '@/components/admin/templates/TemplateListRow';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { useConfirm } from '@/components/ui/ConfirmDialog';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

type TabKey = 'proposal' | 'quote' | 'line_items' | 'packages';

interface LineItemTemplateRow {
  id: string;
  name: string;
  description: string | null;
  items: unknown[];
  created_at: string;
}

interface PackageTemplateRow {
  id: string;
  name: string;
  description: string | null;
  tier: { name?: string; features?: unknown[] } | null;
  created_at: string;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'proposal', label: 'Proposals' },
  { key: 'quote', label: 'Quotes' },
  { key: 'line_items', label: 'Line items' },
  { key: 'packages', label: 'Packages' },
];

export default function TemplatesPage() {
  return (
    <AdminLayout>
      {(auth) => <TemplatesContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

function TemplatesContent({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplateRow[]>([]);
  const [packageTemplates, setPackageTemplates] = useState<PackageTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agencyviz-templates-tab') as TabKey | null;
      if (
        stored === 'proposal' ||
        stored === 'quote' ||
        stored === 'line_items' ||
        stored === 'packages'
      ) return stored;
    }
    return 'proposal';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-templates-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });
  const confirm = useConfirm();

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchQuery('');
    localStorage.setItem('agencyviz-templates-tab', tab);
  };

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-templates-view', mode);
  };

  const fetchProposalTemplates = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  }, [companyId]);

  const fetchLineItemTemplates = useCallback(async () => {
    const res = await fetch('/api/line-item-templates', { headers: await authHeaders() });
    if (res.ok) {
      const json = await res.json();
      setLineItemTemplates(json.templates ?? []);
    }
  }, []);

  const fetchPackageTemplates = useCallback(async () => {
    const res = await fetch('/api/package-templates', { headers: await authHeaders() });
    if (res.ok) {
      const json = await res.json();
      setPackageTemplates(json.templates ?? []);
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchProposalTemplates(),
      fetchLineItemTemplates(),
      fetchPackageTemplates(),
    ]);
    setLoading(false);
  }, [fetchProposalTemplates, fetchLineItemTemplates, fetchPackageTemplates]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // For proposal/quote tabs: filter proposal_templates by entity_type.
  const scoped = activeTab === 'line_items' || activeTab === 'packages'
    ? []
    : templates.filter((t) => (t.entity_type ?? 'proposal') === activeTab);

  const filteredProposalTemplates = searchQuery
    ? scoped.filter((t) =>
        (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : scoped;

  const filteredLineItemTemplates = searchQuery
    ? lineItemTemplates.filter((t) =>
        (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : lineItemTemplates;

  const filteredPackageTemplates = searchQuery
    ? packageTemplates.filter((t) =>
        (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : packageTemplates;

  const showRecent = !searchQuery && activeTab !== 'line_items' && activeTab !== 'packages' && scoped.length >= 8;
  const recent = showRecent
    ? [...scoped]
        .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
        .slice(0, 3)
    : [];

  const tabCount =
    activeTab === 'line_items'
      ? lineItemTemplates.length
      : activeTab === 'packages'
      ? packageTemplates.length
      : scoped.length;
  const tabNoun =
    activeTab === 'line_items'
      ? 'line-item template'
      : activeTab === 'packages'
      ? 'package template'
      : 'template';

  const deletePackageTemplate = async (t: PackageTemplateRow) => {
    const ok = await confirm({
      title: 'Delete package template?',
      message: `"${t.name}" will be removed from the library.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/package-templates/${t.id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (res.ok) {
      setPackageTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete');
    }
  };

  const deleteLineItemTemplate = async (t: LineItemTemplateRow) => {
    const ok = await confirm({
      title: 'Delete line-item template?',
      message: `"${t.name}" will be removed from the library.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/line-item-templates/${t.id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (res.ok) {
      setLineItemTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-divider px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            Template Library
          </h1>
          <p className="text-sm text-muted mt-1">
            {tabCount} {tabNoun}{tabCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle (only meaningful for proposal/quote tabs) */}
          {activeTab !== 'line_items' && (
            <div className="flex items-center bg-surface rounded-full p-1 gap-0.5">
              <button
                onClick={() => toggleView('grid')}
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => toggleView('list')}
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
          )}

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder={`Search ${
                activeTab === 'line_items'
                  ? 'line-item templates'
                  : activeTab === 'packages'
                  ? 'package templates'
                  : 'templates'
              }...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {/* New template (proposals/quotes only — line-item and package
              templates are created from inside their editors via "Save as
              Template"). */}
          {activeTab !== 'line_items' && activeTab !== 'packages' && (
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowUpload(true)}
            >
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-ivory border-b border-gray-200 px-6 lg:px-10">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === 'line_items'
                ? lineItemTemplates.length
                : tab.key === 'packages'
                ? packageTemplates.length
                : templates.filter((t) => (t.entity_type ?? 'proposal') === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'text-teal' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
                <span className={`ml-2 text-xs ${isActive ? 'text-teal/70' : 'text-faint'}`}>
                  {count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal rounded-t-sm" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showUpload && (
          <TemplateUploadModal
            companyId={companyId}
            defaultEntityType={activeTab === 'quote' ? 'quote' : 'proposal'}
            onClose={() => setShowUpload(false)}
            onSuccess={() => { setShowUpload(false); fetchProposalTemplates(); }}
          />
        )}

        {loading ? (
          <EntityListSkeleton viewMode={viewMode} />
        ) : activeTab === 'line_items' ? (
          <LineItemTemplatesView
            templates={filteredLineItemTemplates}
            allCount={lineItemTemplates.length}
            searchQuery={searchQuery}
            onDelete={deleteLineItemTemplate}
          />
        ) : activeTab === 'packages' ? (
          <PackageTemplatesView
            templates={filteredPackageTemplates}
            allCount={packageTemplates.length}
            searchQuery={searchQuery}
            onDelete={deletePackageTemplate}
          />
        ) : filteredProposalTemplates.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No templates matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : scoped.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">
              No {activeTab === 'quote' ? 'quote' : 'proposal'} templates yet
            </h3>
            <p className="text-sm text-faint mb-4">
              {activeTab === 'quote'
                ? 'Save a quote as a template, or upload a PDF to start one.'
                : 'Upload a PDF to create your first template.'}
            </p>
            <Button
              size="sm"
              leftIcon={Upload}
              onClick={() => setShowUpload(true)}
            >
              New Template
            </Button>
          </div>
        ) : (
          <>
            {showRecent && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-3">
                  Recently edited
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {recent.map((t) => (
                      <TemplateListCard
                        key={`recent-${t.id}`}
                        template={t}
                        onRefresh={fetchProposalTemplates}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recent.map((t) => (
                      <TemplateListRow
                        key={`recent-${t.id}`}
                        template={t}
                        onRefresh={fetchProposalTemplates}
                      />
                    ))}
                  </div>
                )}
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mt-8 mb-3">
                  All {activeTab === 'quote' ? 'quote' : 'proposal'} templates · {scoped.length}
                </h2>
              </section>
            )}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProposalTemplates.map((t) => (
                  <TemplateListCard
                    key={t.id}
                    template={t}
                    onRefresh={fetchProposalTemplates}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProposalTemplates.map((t) => (
                  <TemplateListRow
                    key={t.id}
                    template={t}
                    onRefresh={fetchProposalTemplates}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

/* ── Line-item templates view ─────────────────────────────────────── */

function LineItemTemplatesView({
  templates,
  allCount,
  searchQuery,
  onDelete,
}: {
  templates: LineItemTemplateRow[];
  allCount: number;
  searchQuery: string;
  onDelete: (t: LineItemTemplateRow) => void;
}) {
  if (templates.length === 0 && searchQuery) {
    return (
      <div className="text-center py-20">
        <Search size={28} className="text-faint mx-auto mb-3" />
        <p className="text-sm text-muted">No line-item templates matching &ldquo;{searchQuery}&rdquo;</p>
      </div>
    );
  }
  if (allCount === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-faint" />
        </div>
        <h3 className="text-lg font-semibold text-muted mb-1">No line-item templates yet</h3>
        <p className="text-sm text-faint max-w-md mx-auto">
          Inside any quote&rsquo;s line items, click &ldquo;Save as Template&rdquo; to save the
          current item set to your library. It will show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map((t) => (
        <div
          key={t.id}
          className="group relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-ink truncate">{t.name}</h3>
            <button
              onClick={() => onDelete(t)}
              className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-500 transition"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {t.description && (
            <p className="text-xs text-muted line-clamp-2 mb-3">{t.description}</p>
          )}
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>
              {Array.isArray(t.items) ? t.items.length : 0} item
              {Array.isArray(t.items) && t.items.length === 1 ? '' : 's'}
            </span>
            <span>{new Date(t.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PackageTemplatesView({
  templates,
  allCount,
  searchQuery,
  onDelete,
}: {
  templates: PackageTemplateRow[];
  allCount: number;
  searchQuery: string;
  onDelete: (t: PackageTemplateRow) => void;
}) {
  if (templates.length === 0 && searchQuery) {
    return (
      <div className="text-center py-20">
        <Search size={28} className="text-faint mx-auto mb-3" />
        <p className="text-sm text-muted">No package templates matching &ldquo;{searchQuery}&rdquo;</p>
      </div>
    );
  }
  if (allCount === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-faint" />
        </div>
        <h3 className="text-lg font-semibold text-muted mb-1">No package templates yet</h3>
        <p className="text-sm text-faint max-w-md mx-auto">
          Inside any proposal&rsquo;s packages page, click the bookmark icon on a
          package to save it to your library. It will show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map((t) => {
        const featureCount = Array.isArray(t.tier?.features) ? t.tier!.features!.length : 0;
        return (
          <div
            key={t.id}
            className="group relative bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-ink truncate">{t.name}</h3>
              <button
                onClick={() => onDelete(t)}
                className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-500 transition"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {t.description && (
              <p className="text-xs text-muted line-clamp-2 mb-3">{t.description}</p>
            )}
            <div className="flex items-center justify-between text-[11px] text-faint">
              <span>
                {featureCount} feature{featureCount === 1 ? '' : 's'}
              </span>
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
