// app/quotes/page.tsx
// Independent Quotes list. Filtered to entity_type='quote' so the proposals
// list never overlaps. Open routes into /quotes/[id] (Builder / Cover / Settings),
// not the legacy /proposals/[id]/quote-* tree.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, ReceiptText, LayoutGrid, List, Search, ChevronDown, LayoutTemplate, KanbanSquare } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
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

const VIEW_MODE_KEY = 'agencyviz_quote_view';

export default function QuotesPage() {
  return (
    <AdminLayout>
      {(auth) => <QuotesContent companyId={auth.companyId!} />}
    </AdminLayout>
  );
}

function QuotesContent({ companyId }: { companyId: string }) {
  const [quotes, setQuotes] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadInitialTab, setUploadInitialTab] = useState<'quote' | 'quote-template'>('quote');
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'grid' || stored === 'list' || stored === 'board') setViewMode(stored);
  }, []);

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const updateQuoteStatus = async (id: string, next: ProposalStatus) => {
    const patch = buildStatusPatch(next);
    setQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...(patch as Partial<Proposal>) } : q)),
    );
    const { error } = await supabase.from('proposals').update(patch).eq('id', id);
    if (error) throw error;
  };

  const fetchQuotes = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'quote')
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }, [companyId]);

  const fetchCustomDomain = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) setCustomDomain(data.custom_domain);
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchQuotes();
    fetchCustomDomain();
  }, [fetchQuotes, fetchCustomDomain]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModal = (tab: 'quote' | 'quote-template') => {
    setUploadInitialTab(tab);
    setShowUpload(true);
    setShowNewDropdown(false);
  };

  const filtered = searchQuery
    ? quotes.filter((p) =>
        (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : quotes;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">Quotes</h1>
          <p className="text-sm text-muted mt-1">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface rounded-full p-1 gap-0.5">
            <button
              onClick={() => toggleViewMode('grid')}
              className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'grid' ? 'bg-white shadow-sm text-ink' : 'text-faint hover:text-muted'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => toggleViewMode('list')}
              className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'list' ? 'bg-white shadow-sm text-ink' : 'text-faint hover:text-muted'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => toggleViewMode('board')}
              className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'board' ? 'bg-white shadow-sm text-ink' : 'text-faint hover:text-muted'
              }`}
              title="Board view"
            >
              <KanbanSquare size={16} />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>

          <div className="relative" ref={newDropdownRef}>
            <button
              onClick={() => setShowNewDropdown((v) => !v)}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-full px-4 py-2 shadow-sm transition-colors"
            >
              <Plus size={16} />
              New
              <ChevronDown size={14} className={`transition-transform ${showNewDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showNewDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
                <button
                  onClick={() => openModal('quote')}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <ReceiptText size={15} className="text-gray-400 shrink-0" />
                  <div>
                    <div className="font-medium">New Quote</div>
                    <div className="text-xs text-gray-400">Start blank</div>
                  </div>
                </button>
                <button
                  onClick={() => openModal('quote-template')}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                >
                  <LayoutTemplate size={15} className="text-gray-400 shrink-0" />
                  <div>
                    <div className="font-medium">From Template</div>
                    <div className="text-xs text-gray-400">Use a saved quote template</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showUpload && (
          <UploadModal
            companyId={companyId}
            onClose={() => setShowUpload(false)}
            onSuccess={fetchQuotes}
            initialTab={uploadInitialTab}
          />
        )}

        {loading ? (
          <EntityListSkeleton viewMode={viewMode === 'board' ? 'grid' : viewMode} />
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No quotes matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ReceiptText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">No quotes yet</h3>
            <p className="text-sm text-faint">Send your first quote in a few minutes.</p>
            <button
              onClick={() => openModal('quote')}
              className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-full px-4 py-2 shadow-sm transition-colors"
            >
              <Plus size={16} />
              New Quote
            </button>
          </div>
        ) : viewMode === 'board' ? (
          <KanbanBoard
            columns={
              PROPOSAL_STATUS_ORDER.map<KanbanColumn<Proposal>>((status) => ({
                id: status,
                label: PROPOSAL_STATUS_CONFIG[status].label,
                accentHex: PROPOSAL_STATUS_CONFIG[status].hex,
                items: filtered.filter((q) => q.status === status),
              }))
            }
            renderCard={(q) => <ProposalBoardCard proposal={q} kind="quote" />}
            onMove={(id, _from, to) => updateQuoteStatus(id, to as ProposalStatus)}
            emptyMessage="Drag a quote here."
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((q) => (
              <ProposalListCard
                key={q.id}
                proposal={q}
                onRefresh={fetchQuotes}
                customDomain={customDomain}
                hrefOverride={`/quotes/${q.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((q) => (
              <ProposalListRow
                key={q.id}
                proposal={q}
                onRefresh={fetchQuotes}
                customDomain={customDomain}
                hrefOverride={`/quotes/${q.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
