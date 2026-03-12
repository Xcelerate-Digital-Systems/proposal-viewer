// app/templates/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Upload, LayoutGrid, List, Search } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import TemplateUploadModal from '@/components/admin/templates/TemplateUploadModal';
import TemplateListCard from '@/components/admin/templates/TemplateListCard';
import TemplateListRow from '@/components/admin/templates/TemplateListRow';

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
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-templates-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-templates-view', mode);
  };

  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = searchQuery
    ? templates.filter((t) =>
        (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : templates;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            Templates
          </h1>
          <p className="text-sm text-muted mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-surface rounded-[10px] p-1 gap-0.5">
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
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2.5 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {/* New template */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showUpload && (
          <TemplateUploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={() => { setShowUpload(false); fetchTemplates(); }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No templates matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">No templates yet</h3>
            <p className="text-sm text-faint mb-4">Upload a PDF to create your first template</p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Upload size={16} />
              Upload Template PDF
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t) => (
              <TemplateListCard
                key={t.id}
                template={t}
                onRefresh={fetchTemplates}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <TemplateListRow
                key={t.id}
                template={t}
                onRefresh={fetchTemplates}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}