// app/clients/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserSquare2, Plus, LogIn, Users, FileText, Clock, X, Loader2,
  Search, MoreHorizontal, Pencil, Trash2,
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

  const filtered = searchQuery
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clients;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clients"
        description={`${clients.length} client account${clients.length !== 1 ? 's' : ''}`}
        actions={<>
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-caption text-ink placeholder-faint outline-none w-full"
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
            <p className="text-sm text-muted">No clients matching &ldquo;{searchQuery}&rdquo;</p>
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
                      <h3 className="text-sm font-semibold text-ink truncate">{client.name}</h3>
                      <p className="text-xs text-faint truncate mt-0.5">{client.slug}</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-faint">
                    <div className="flex items-center gap-1.5" title="Proposals">
                      <FileText size={13} />
                      <span>{client.stats.proposals}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Team members">
                      <Users size={13} />
                      <span>{client.stats.members}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Last activity">
                      <Clock size={13} />
                      <span>{formatDate(client.stats.lastActivity)}</span>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-5 py-3 border-t border-edge flex items-center gap-2">
                  <button
                    onClick={() => handleEnter(client)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                      bg-surface text-muted border border-edge
                      hover:bg-teal/10 hover:text-teal hover:border-teal/30
                      transition-all"
                  >
                    <LogIn size={14} />
                    Enter Account
                  </button>
                  <button
                    onClick={() => handleDelete(client)}
                    className="p-2 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete client"
                  >
                    <Trash2 size={14} />
                  </button>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Client</h2>
          <button onClick={onClose} className="text-faint hover:text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Client Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Plumbing"
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="acme-plumbing"
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            <p className="text-xs text-faint mt-1">Used for internal identification</p>
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
