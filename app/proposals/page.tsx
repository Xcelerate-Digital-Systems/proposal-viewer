// app/proposals/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FileText, LayoutGrid, List, Search, ChevronDown, Upload, LayoutTemplate, KanbanSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import NoResults from '@/components/ui/NoResults';
import { supabase, Proposal } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import UploadModal from '@/components/admin/proposals/UploadModal';
import ProposalListCard from '@/components/admin/proposals/ProposalListCard';
import ProposalListRow from '@/components/admin/proposals/ProposalListRow';
import ProposalBoardCard from '@/components/admin/proposals/ProposalBoardCard';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import {
  PROPOSAL_STATUS_ORDER,
  PROPOSAL_STATUS_CONFIG,
  buildStatusPatch,
  type ProposalStatus,
} from '@/lib/proposals/status';

type ViewMode = 'grid' | 'list' | 'board';

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
  const [uploadInitialTab, setUploadInitialTab] = useState<'upload' | 'template'>('upload');
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [searchQuery, setSearchQuery] = useState('');

  // Restore view preference
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'grid' || stored === 'list' || stored === 'board') {
      setViewMode(stored);
    }
  }, []);

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  // Optimistic status update via the kanban board's drop callback. Also
  // stamps the matching outcome timestamp (sent_at / accepted_at / etc).
  const updateProposalStatus = async (id: string, next: ProposalStatus) => {
    const patch = buildStatusPatch(next);
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(patch as Partial<Proposal>) } : p)),
    );
    const { error } = await supabase.from('proposals').update(patch).eq('id', id);
    if (error) throw error;
  };

  const fetchProposals = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'proposal')
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModal = (tab: 'upload' | 'template') => {
    setUploadInitialTab(tab);
    setShowUpload(true);
    setShowNewDropdown(false);
  };

  const filtered = searchQuery
    ? proposals.filter((p) =>
        (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : proposals;

  // "Recently edited" — only when the list is long enough that scrolling is real
  // and no search is active. Sorted by updated_at, falling back to created_at.
  const showRecent = !searchQuery && proposals.length >= 8;
  const recent = showRecent
    ? [...proposals]
        .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
        .slice(0, 3)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-divider px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            Pitch Studio
          </h1>
          <p className="text-sm text-muted mt-1">
            {proposals.length} pitch{proposals.length !== 1 ? 'es' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-surface rounded-full p-1 gap-0.5">
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
            <button
              onClick={() => toggleViewMode('board')}
              className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'board'
                  ? 'bg-white shadow-sm text-ink'
                  : 'text-faint hover:text-muted'
              }`}
              title="Board view"
            >
              <KanbanSquare size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search pitches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          {/* New — dropdown */}
          <div className="relative" ref={newDropdownRef}>
            <Button
              size="sm"
              leftIcon={Plus}
              rightIcon={ChevronDown}
              onClick={() => setShowNewDropdown((v) => !v)}
            >
              New
            </Button>

            {showNewDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
                <button
                  onClick={() => openModal('upload')}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Upload size={15} className="text-gray-400 shrink-0" />
                  <div>
                    <div className="font-medium">New Pitch</div>
                    <div className="text-xs text-gray-400">Upload a PDF</div>
                  </div>
                </button>
                <button
                  onClick={() => openModal('template')}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                >
                  <LayoutTemplate size={15} className="text-gray-400 shrink-0" />
                  <div>
                    <div className="font-medium">Pitch from Template</div>
                    <div className="text-xs text-gray-400">Use a pitch template</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content — board uses overflow-hidden + tight padding so it can fill
          the available height; list/grid keep the standard vertical scroll. */}
      <div className={`flex-1 px-6 lg:px-10 ${viewMode === 'board' ? 'pt-4 pb-8 overflow-hidden' : 'py-8 overflow-y-auto'}`}>
        {showUpload && (
          <UploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={fetchProposals}
            initialTab={uploadInitialTab}
          />
        )}

        {loading ? (
          <EntityListSkeleton viewMode={viewMode === 'board' ? 'grid' : viewMode} />
        ) : filtered.length === 0 && searchQuery ? (
          <NoResults message={`No pitches matching “${searchQuery}”`} />
        ) : proposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No pitches yet"
            description="Upload your first pitch to get started."
            action={
              <Button size="sm" leftIcon={Plus} onClick={() => openModal('upload')}>
                New Pitch
              </Button>
            }
          />
        ) : viewMode === 'board' ? (
          <KanbanBoard
            columns={
              PROPOSAL_STATUS_ORDER.map<KanbanColumn<Proposal>>((status) => ({
                id: status,
                label: PROPOSAL_STATUS_CONFIG[status].label,
                accentHex: PROPOSAL_STATUS_CONFIG[status].hex,
                items: filtered.filter((p) => p.status === status),
              }))
            }
            renderCard={(p) => <ProposalBoardCard proposal={p} kind="proposal" />}
            onMove={(id, _from, to) => updateProposalStatus(id, to as ProposalStatus)}
            emptyMessage="Drag a pitch here."
          />
        ) : (
          <>
            {showRecent && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-3">
                  Recently edited
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {recent.map((p) => (
                      <ProposalListCard
                        key={`recent-${p.id}`}
                        proposal={p}
                        onRefresh={fetchProposals}
                        customDomain={customDomain}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recent.map((p) => (
                      <ProposalListRow
                        key={`recent-${p.id}`}
                        proposal={p}
                        onRefresh={fetchProposals}
                        customDomain={customDomain}
                      />
                    ))}
                  </div>
                )}
                <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mt-8 mb-3">
                  All pitches · {proposals.length}
                </h2>
              </section>
            )}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          </>
        )}
      </div>
    </div>
  );
}
