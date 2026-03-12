// app/proposals/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, LayoutGrid, List, Search } from 'lucide-react';
import { supabase, Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import UploadModal from '@/components/admin/proposals/UploadModal';
import ProposalListCard from '@/components/admin/proposals/ProposalListCard';
import ProposalListRow from '@/components/admin/proposals/ProposalListRow';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'agencyviz_proposal_view';

export default function ProposalsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <ProposalsContent companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function ProposalsContent({ companyId }: { companyId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Restore view preference
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'grid' || stored === 'list') {
      setViewMode(stored);
    }
  }, []);

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const fetchProposals = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setProposals(data || []);
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
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchProposals();
    fetchCustomDomain();
  }, [fetchProposals, fetchCustomDomain]);

  const filtered = searchQuery
    ? proposals.filter((p) =>
        (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : proposals;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            Proposals
          </h1>
          <p className="text-sm text-muted mt-1">
            {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-surface rounded-[10px] p-1 gap-0.5">
            <button
              onClick={() => toggleViewMode('grid')}
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
              onClick={() => toggleViewMode('list')}
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
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {/* New proposal */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            New Proposal
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showUpload && (
          <UploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={fetchProposals}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No proposals matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">No proposals yet</h3>
            <p className="text-sm text-faint">Upload your first proposal to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Proposal
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => (
              <ProposalListCard
                key={p.id}
                proposal={p}
                onRefresh={fetchProposals}
                customDomain={customDomain}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <ProposalListRow
                key={p.id}
                proposal={p}
                onRefresh={fetchProposals}
                customDomain={customDomain}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
