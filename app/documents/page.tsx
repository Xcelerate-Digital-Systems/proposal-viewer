// app/documents/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, LayoutGrid, List, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase, Document as DocType } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import DocumentUploadModal from '@/components/admin/documents/DocumentUploadModal';
import DocumentListCard from '@/components/admin/documents/DocumentListCard';
import DocumentListRow from '@/components/admin/documents/DocumentListRow';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';

export default function DocumentsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <DocumentsContent companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DocumentsContent({ companyId }: { companyId: string }) {
  const [documents, setDocuments] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-documents-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-documents-view', mode);
  };

  const fetchDocuments = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  }, [companyId]);

  const fetchCustomDomain = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    } else {
      setCustomDomain(null);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchDocuments();
    fetchCustomDomain();
  }, [fetchDocuments, fetchCustomDomain]);

  const filtered = searchQuery
    ? documents.filter((d) =>
        (d.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (d.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : documents;

  const showRecent = !searchQuery && documents.length >= 8;
  const recent = showRecent
    ? [...documents]
        .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
        .slice(0, 3)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-divider px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            Documents
          </h1>
          <p className="text-sm text-muted mt-1">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
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

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {/* New document */}
          <Button
            size="sm"
            leftIcon={Plus}
            onClick={() => setShowUpload(true)}
          >
            New Document
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showUpload && (
          <DocumentUploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={fetchDocuments}
          />
        )}

        {loading ? (
          <EntityListSkeleton
            viewMode={viewMode}
            gridCols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            gridGap="gap-5"
          />
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No documents matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">No documents yet</h3>
            <p className="text-sm text-faint">Upload a PDF to create a shareable document</p>
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowUpload(true)}
              className="mt-4"
            >
              New Document
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {recent.map((doc) => (
                      <DocumentListCard
                        key={`recent-${doc.id}`}
                        document={doc}
                        onRefresh={fetchDocuments}
                        customDomain={customDomain}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recent.map((doc) => (
                      <DocumentListRow
                        key={`recent-${doc.id}`}
                        document={doc}
                        onRefresh={fetchDocuments}
                        customDomain={customDomain}
                      />
                    ))}
                  </div>
                )}
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mt-8 mb-3">
                  All documents · {documents.length}
                </h2>
              </section>
            )}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((doc) => (
                  <DocumentListCard
                    key={doc.id}
                    document={doc}
                    onRefresh={fetchDocuments}
                    customDomain={customDomain}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((doc) => (
                  <DocumentListRow
                    key={doc.id}
                    document={doc}
                    onRefresh={fetchDocuments}
                    customDomain={customDomain}
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