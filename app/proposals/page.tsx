// app/proposals/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, LayoutGrid, List } from 'lucide-react';
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

  return (
    <div className="flex flex-col h-full">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-8 pb-4 border-b border-gray-200 lg:border-b-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">
              Proposals
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => toggleViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => toggleViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>

            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-[#017C87] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
            >
              <Plus size={16} />
              New Proposal
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-4 lg:pt-0">
        {showUpload && (
          <UploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={fetchProposals}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No proposals yet</h3>
            <p className="text-sm text-gray-400">Upload your first proposal to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {proposals.map((p) => (
              <ProposalListCard
                key={p.id}
                proposal={p}
                onRefresh={fetchProposals}
                customDomain={customDomain}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {proposals.map((p) => (
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