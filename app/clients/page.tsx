// app/clients/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserSquare2, Plus, LogIn, Users, FileText, Clock, X,
  Search, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import AdminLayout from '@/components/admin/AdminLayout';

type ClientSortOption = 'name-az' | 'activity' | 'proposals' | 'newest';

const CLIENT_SORT_LABELS: Record<ClientSortOption, string> = {
  'name-az': 'Name A–Z',
  activity: 'Last activity',
  proposals: 'Most proposals',
  newest: 'Newest first',
};

function sortClients(clients: ClientWithStats[], sort: ClientSortOption): ClientWithStats[] {
  const sorted = [...clients];
  switch (sort) {
    case 'name-az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'activity':
      return sorted.sort((a, b) => {
        if (!a.stats.lastActivity && !b.stats.lastActivity) return 0;
        if (!a.stats.lastActivity) return 1;
        if (!b.stats.lastActivity) return -1;
        return b.stats.lastActivity.localeCompare(a.stats.lastActivity);
      });
    case 'proposals':
      return sorted.sort((a, b) => b.stats.proposals - a.stats.proposals);
    case 'newest':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      return sorted;
  }
}

interface ClientWithStats {
  id: string;
  name: string;
  slug: string;
  accent_color: string;
  logo_path: string | null;
  created_at: string;
  stats: {
    proposals: number;
    members: number;
    lastActivity: string | null;
  };
}

export default function ClientsPage() {
  return (
    <AdminLayout>
      {(auth) => {
        if (!auth.isAgencyAdmin && !auth.isSuperAdmin) {
          return (
            <div className="flex items-center justify-center h-screen">
              <p className="text-faint">Access denied</p>
            </div>
          );
        }
        return (
          <ClientsContent
            companyId={auth.companyId ?? ''}
            onEnterClient={auth.setCompanyOverride}
          />
        );
      }}
    </AdminLayout>
  );
}

function ClientsContent({
  companyId,
  onEnterClient,
}: {
  companyId: string;
  onEnterClient: (companyId: string, companyName: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ClientSortOption>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-clients-sort') as ClientSortOption) || 'name-az';
    }
    return 'name-az';
  });

  const handleSortChange = (sort: ClientSortOption) => {
    setSortBy(sort);
    localStorage.setItem('agencyviz-clients-sort', sort);
  };

  const fetchClients = useCallback(async () => {
    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/clients?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleEnter = (client: ClientWithStats) => {
    onEnterClient(client.id, client.name);
    window.location.href = '/';
  };

  const handleDelete = async (client: ClientWithStats) => {
    const ok = await confirm({
      title: 'Delete Client',
      message: `Delete "${client.name}" and all their data? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      toast.success('Client deleted');
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } else {
      toast.error('Failed to delete client');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No activity';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filtered = sortClients(
    searchQuery
      ? clients.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : clients,
    sortBy,
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        actions={<>
          <div className="relative hidden md:block">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as ClientSortOption)}
              className="appearance-none bg-surface rounded-full px-3 pr-7 py-2 text-xs font-medium text-dim cursor-pointer hover:text-ink focus-visible:ring-2 focus-visible:ring-teal/30 focus-visible:outline-none transition-colors"
              aria-label="Sort clients"
            >
              {(Object.entries(CLIENT_SORT_LABELS) as [ClientSortOption, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          </div>
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-dim shrink-0" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-caption text-ink placeholder:text-dim outline-none w-full"
            />
          </div>
          <Button leftIcon={Plus} size="sm" onClick={() => setShowCreate(true)}>
            New Client
          </Button>
        </>}
      />

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {loading ? (
          <EntityListSkeleton viewMode="grid" />
        ) : fetchError ? (
          <ErrorState
            description={fetchError}
            onRetry={() => { setLoading(true); fetchClients(); }}
          />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={UserSquare2}
            title="No clients yet"
            description="Create your first client account. Clients get access to your pitch tools — proposals, quotes, documents, and templates."
            action={
              <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>
                New Client
              </Button>
            }
          />
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-16">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-dim">No clients matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {filtered.map((client) => (
              <div
                key={client.id}
                className="group bg-white rounded-2xl border border-edge-strong hover:border-teal/30 hover:shadow-md transition-all flex flex-col"
              >
                {/* Card header with accent bar */}
                <div
                  className="h-1.5 rounded-t-2xl"
                  style={{ backgroundColor: client.accent_color || '#017C87' }}
                />

                <div className="p-5 flex-1">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{
                        backgroundColor: (client.accent_color || '#017C87') + '12',
                        color: client.accent_color || '#017C87',
                      }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-ink truncate leading-tight">{client.name}</h3>
                      <p className="text-xs text-dim truncate mt-0.5">{client.slug}</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-dim">
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} aria-hidden="true" />
                      <span>{client.stats.proposals} proposals</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={13} aria-hidden="true" />
                      <span>{client.stats.members} members</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} aria-hidden="true" />
                      <span>{formatDate(client.stats.lastActivity)}</span>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-5 py-3 border-t border-edge flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={LogIn}
                    onClick={() => handleEnter(client)}
                    aria-label={`Enter account for ${client.name}`}
                    className="flex-1"
                  >
                    Enter Account
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    leftIcon={Trash2}
                    onClick={() => handleDelete(client)}
                    aria-label={`Delete ${client.name}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClientModal
          companyId={companyId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}

function CreateClientModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40)
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/clients?company_id=${companyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create client');
    }
    setSaving(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-client-title"
        className="bg-white rounded-2xl shadow-modal w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 id="create-client-title" className="text-base font-semibold text-ink">New Client</h2>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="client-name" className="block text-xs font-medium text-dim mb-1.5">Client Name</label>
            <input
              id="client-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Plumbing"
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
              autoFocus
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-dim hover:text-ink transition-colors"
            >
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-2">
                <label htmlFor="client-slug" className="block text-xs font-medium text-dim mb-1.5">Slug</label>
                <input
                  id="client-slug"
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  placeholder="acme-plumbing"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                />
                <p className="text-xs text-dim mt-1">Used for internal identification</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-edge">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            leftIcon={Plus}
            loading={saving}
            disabled={!name.trim() || !slug.trim()}
            onClick={handleSubmit}
          >
            Create Client
          </Button>
        </div>
      </div>
    </div>
  );
}
