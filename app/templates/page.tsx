// app/templates/page.tsx
// Templates index — three tabs:
//   • Proposals   → proposal_templates where entity_type = 'proposal'
//   • Quotes      → proposal_templates where entity_type = 'quote'
//   • Line items  → line_item_templates (saved item sets used by the quote
//                   builder's "From Library" button)
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, FileText, Upload, LayoutGrid, List, Search, ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import NoResults from '@/components/ui/NoResults';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-fetch';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import TemplateUploadModal from '@/components/admin/templates/TemplateUploadModal';
import TemplateListCard from '@/components/admin/templates/TemplateListCard';
import TemplateListRow from '@/components/admin/templates/TemplateListRow';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import PackageTemplateEditorModal from '@/components/admin/templates/PackageTemplateEditorModal';
import LineItemTemplateEditorModal from '@/components/admin/templates/LineItemTemplateEditorModal';
import type { PackageTier } from '@/lib/types/packages';

import type { TabKey, LineItemTemplateRow, PackageTemplateRow, PageLibraryRow, SortKey } from './templates-types';
import { TABS, sortItems } from './templates-types';
import LineItemTemplatesView from './LineItemTemplatesView';
import PackageTemplatesView from './PackageTemplatesView';
import PageLibraryView from './PageLibraryView';

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
  const [libraryPages, setLibraryPages] = useState<PageLibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agencyviz-templates-tab') as TabKey | null;
      if (
        stored === 'proposal' ||
        stored === 'quote' ||
        stored === 'line_items' ||
        stored === 'packages' ||
        stored === 'pages'
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
  const [editingPackage, setEditingPackage] = useState<PackageTemplateRow | null>(null);
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<LineItemTemplateRow | null>(null);
  const [showLineItemEditor, setShowLineItemEditor] = useState(false);

  const openNewLineItem = () => {
    setEditingLineItem(null);
    setShowLineItemEditor(true);
  };

  const openEditLineItem = (t: LineItemTemplateRow) => {
    setEditingLineItem(t);
    setShowLineItemEditor(true);
  };

  const handleLineItemSaved = (saved: { id: string; name: string; description: string | null; items: unknown[]; created_at: string }) => {
    setLineItemTemplates((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p));
      }
      return [saved as LineItemTemplateRow, ...prev];
    });
  };

  const openNewPackage = () => {
    setEditingPackage(null);
    setShowPackageEditor(true);
  };

  const openEditPackage = (t: PackageTemplateRow) => {
    setEditingPackage(t);
    setShowPackageEditor(true);
  };

  const handlePackageSaved = (saved: { id: string; name: string; description: string | null; tier: PackageTier | { name?: string; features?: unknown[] } | null; created_at: string }) => {
    setPackageTemplates((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p));
      }
      return [{ ...saved, tier: saved.tier as PackageTemplateRow['tier'] }, ...prev];
    });
  };

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
    const { data, error } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setTemplates(data || []);
  }, [companyId]);

  const fetchLineItemTemplates = useCallback(async () => {
    const res = await authedFetch('/api/line-item-templates');
    if (!res.ok) { console.error(`[templates] line-item-templates ${res.status}`); return; }
    const json = await res.json();
    setLineItemTemplates(json.templates ?? []);
  }, []);

  const fetchPackageTemplates = useCallback(async () => {
    const res = await authedFetch('/api/package-templates');
    if (!res.ok) { console.error(`[templates] package-templates ${res.status}`); return; }
    const json = await res.json();
    setPackageTemplates(json.templates ?? []);
  }, []);

  const fetchLibraryPages = useCallback(async () => {
    const res = await authedFetch('/api/page-library');
    if (!res.ok) { console.error(`[templates] page-library ${res.status}`); return; }
    const json = await res.json();
    setLibraryPages(json ?? []);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      await Promise.allSettled([
        fetchProposalTemplates(),
        fetchLineItemTemplates(),
        fetchPackageTemplates(),
        fetchLibraryPages(),
      ]);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [fetchProposalTemplates, fetchLineItemTemplates, fetchPackageTemplates, fetchLibraryPages]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // For proposal/quote tabs: filter proposal_templates by entity_type.
  const scoped = activeTab === 'line_items' || activeTab === 'packages'
    ? []
    : templates.filter((t) => (t.entity_type ?? 'proposal') === activeTab);

  const filteredProposalTemplates = sortItems(
    searchQuery
      ? scoped.filter((t) =>
          (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
      : scoped,
    sortBy,
  );

  const filteredLineItemTemplates = sortItems(
    searchQuery
      ? lineItemTemplates.filter((t) =>
          (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
      : lineItemTemplates,
    sortBy,
  );

  const filteredPackageTemplates = sortItems(
    searchQuery
      ? packageTemplates.filter((t) =>
          (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
      : packageTemplates,
    sortBy,
  );

  const filteredLibraryPages = sortItems(
    searchQuery
      ? libraryPages.filter((p) =>
          (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (p.label?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
      : libraryPages,
    sortBy,
  );

  const showRecent = !searchQuery && activeTab !== 'line_items' && activeTab !== 'packages' && activeTab !== 'pages' && scoped.length >= 8;
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
      : activeTab === 'pages'
      ? libraryPages.length
      : scoped.length;
  const tabNoun =
    activeTab === 'line_items'
      ? 'line-item template'
      : activeTab === 'packages'
      ? 'package template'
      : activeTab === 'pages'
      ? 'saved page'
      : 'template';

  const deletePackageTemplate = async (t: PackageTemplateRow) => {
    const ok = await confirm({
      title: 'Delete package template?',
      message: `"${t.name}" will be removed from the library.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await authedFetch(`/api/package-templates/${t.id}`, {
      method: 'DELETE',
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
    const res = await authedFetch(`/api/line-item-templates/${t.id}`, {
      method: 'DELETE',
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
      <PageHeader
        title="Template Library"
        description={`${tabCount} ${tabNoun}${tabCount !== 1 ? 's' : ''}`}
        actions={<>
          {/* View toggle (only meaningful for proposal/quote tabs) */}
          {activeTab !== 'line_items' && activeTab !== 'packages' && activeTab !== 'pages' && (
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

          {/* Sort */}
          <div className="hidden md:flex items-center gap-1.5 bg-surface rounded-full px-3 py-2 text-caption text-dim">
            <ArrowUpDown size={14} className="text-faint shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-transparent outline-none cursor-pointer text-caption text-ink"
            >
              <option value="updated">Recently edited</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </select>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder={`Search${
                activeTab === 'line_items'
                  ? ' line-item templates'
                  : activeTab === 'packages'
                  ? ' package templates'
                  : activeTab === 'pages'
                  ? ' saved pages'
                  : ''
              }... ⌘K`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-caption text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {activeTab === 'packages' ? (
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={openNewPackage}
            >
              New Package
            </Button>
          ) : activeTab === 'line_items' ? (
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={openNewLineItem}
            >
              New Line Items
            </Button>
          ) : activeTab === 'pages' ? null : (
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowUpload(true)}
            >
              New Template
            </Button>
          )}
        </>}
      />

      {/* Tabs */}
      <div className="bg-ivory border-b border-edge-strong px-6 lg:px-10">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === 'line_items'
                ? lineItemTemplates.length
                : tab.key === 'packages'
                ? packageTemplates.length
                : tab.key === 'pages'
                ? libraryPages.length
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

        <LineItemTemplateEditorModal
          open={showLineItemEditor}
          onClose={() => setShowLineItemEditor(false)}
          template={editingLineItem}
          onSaved={handleLineItemSaved}
        />

        <PackageTemplateEditorModal
          open={showPackageEditor}
          onClose={() => setShowPackageEditor(false)}
          template={editingPackage ? {
            id: editingPackage.id,
            name: editingPackage.name,
            description: editingPackage.description,
            tier: editingPackage.tier as PackageTier,
          } : null}
          onSaved={handlePackageSaved}
        />

        {loading ? (
          <EntityListSkeleton viewMode={viewMode} />
        ) : fetchError ? (
          <ErrorState
            description={fetchError}
            onRetry={refetch}
          />
        ) : activeTab === 'line_items' ? (
          <LineItemTemplatesView
            templates={filteredLineItemTemplates}
            allCount={lineItemTemplates.length}
            searchQuery={searchQuery}
            onDelete={deleteLineItemTemplate}
            onEdit={openEditLineItem}
          />
        ) : activeTab === 'packages' ? (
          <PackageTemplatesView
            templates={filteredPackageTemplates}
            allCount={packageTemplates.length}
            searchQuery={searchQuery}
            onDelete={deletePackageTemplate}
            onEdit={openEditPackage}
          />
        ) : activeTab === 'pages' ? (
          <PageLibraryView
            pages={filteredLibraryPages}
            allCount={libraryPages.length}
            searchQuery={searchQuery}
            onDelete={async (p) => {
              const ok = await confirm({
                title: 'Delete saved page?',
                message: `"${p.label || p.title}" will be removed from the library.`,
                confirmLabel: 'Delete',
                destructive: true,
              });
              if (!ok) return;
              const res = await authedFetch('/api/page-library', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: p.id }),
              });
              if (res.ok) {
                setLibraryPages((prev) => prev.filter((x) => x.id !== p.id));
                toast.success('Page removed from library');
              } else {
                toast.error('Failed to delete');
              }
            }}
            onRename={async (p, newTitle) => {
              const res = await authedFetch('/api/page-library', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: p.id, title: newTitle }),
              });
              if (res.ok) {
                setLibraryPages((prev) =>
                  prev.map((x) => (x.id === p.id ? { ...x, title: newTitle, updated_at: new Date().toISOString() } : x))
                );
                toast.success('Page renamed');
              } else {
                toast.error('Failed to rename');
              }
            }}
            onReplacePdf={async (p, file) => {
              const tempPath = `page-library/temp-${Date.now()}.pdf`;
              const { error: uploadErr } = await supabase.storage
                .from('proposals')
                .upload(tempPath, file, { upsert: true, contentType: 'application/pdf' });
              if (uploadErr) {
                toast.error('Failed to upload file');
                return;
              }
              const res = await authedFetch('/api/page-library', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: p.id, replace_file_path: tempPath }),
              });
              if (res.ok) {
                const updated = await res.json();
                setLibraryPages((prev) =>
                  prev.map((x) => (x.id === p.id ? { ...x, payload: updated.payload, updated_at: updated.updated_at } : x))
                );
                toast.success('PDF replaced');
              } else {
                toast.error('Failed to replace PDF');
              }
            }}
          />
        ) : filteredProposalTemplates.length === 0 && searchQuery ? (
          <NoResults message={`No templates matching "${searchQuery}"`} />
        ) : scoped.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={`No ${activeTab === 'quote' ? 'quote' : 'proposal'} templates yet`}
            description={
              activeTab === 'quote'
                ? 'Save a quote as a template, or upload a PDF to start one.'
                : 'Upload a PDF to create your first template.'
            }
            action={
              <Button size="sm" leftIcon={Upload} onClick={() => setShowUpload(true)}>
                New Template
              </Button>
            }
          />
        ) : (
          <>
            {showRecent && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-3">
                  Recently edited
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
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
