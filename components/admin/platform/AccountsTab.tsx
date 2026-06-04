'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, LogIn, Users, FileText, Clock, Search,
  X, Crown, ShieldCheck, AlertCircle, Check, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface CompanyWithStats {
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
  subscription: {
    status: string;
    plan_slug: string;
    plan_name: string;
  } | null;
}

interface AccountsTabProps {
  onMetricsChange: () => void;
}

export default function AccountsTab({ onMetricsChange }: AccountsTabProps) {
  const toast = useToast();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [granting, setGranting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Failed to load accounts (${res.status})`);
      setCompanies(await res.json());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleViewAs = (company: CompanyWithStats) => {
    const override = JSON.stringify({ companyId: company.id, companyName: company.name });
    localStorage.setItem('company_override', override);
    window.location.href = '/';
  };

  const handleToggleLifetime = async (company: CompanyWithStats) => {
    const isLifetime = company.subscription?.plan_slug === 'lifetime';
    setGranting(company.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setGranting(null); return; }
      const res = await fetch(`/api/admin/accounts/${company.id}/subscription`, {
        method: isLifetime ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to update subscription');
      } else {
        toast.success(
          isLifetime
            ? `Revoked lifetime access for ${company.name}`
            : `Granted lifetime access to ${company.name}`,
        );
        fetchCompanies();
        onMetricsChange();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setGranting(null);
    }
  };

  const filtered = search.trim()
    ? companies.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : companies;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No activity';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <EntityListSkeleton viewMode="grid" />;
  if (fetchError) {
    return (
      <ErrorState
        description={fetchError}
        onRetry={() => { setLoading(true); fetchCompanies(); }}
      />
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
          />
        </div>
        <Button leftIcon={Plus} size="sm" onClick={() => setShowCreate(true)}>
          New Account
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={28} className="text-faint mx-auto mb-3" />
          <h3 className="text-base font-semibold text-muted mb-1">
            {search ? 'No matching accounts' : 'No accounts yet'}
          </h3>
          <p className="text-sm text-faint mb-5">
            {search ? 'Try a different search term.' : 'Create your first agency account.'}
          </p>
          {!search && (
            <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>New Account</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company) => (
            <div
              key={company.id}
              className="bg-white border border-edge rounded-[14px] transition-all group flex flex-col"
            >
              <div className="p-5 flex-1">
                <div className="flex items-start gap-3.5 mb-4">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      backgroundColor: (company.accent_color || '#017C87') + '18',
                      color: company.accent_color || '#017C87',
                    }}
                  >
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink truncate">{company.name}</h3>
                      <SubBadge subscription={company.subscription} />
                    </div>
                    <p className="text-xs text-faint truncate mt-0.5">{company.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-faint">
                  <div className="flex items-center gap-1.5" title="Proposals">
                    <FileText size={13} />
                    <span>{company.stats.proposals}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Team members">
                    <Users size={13} />
                    <span>{company.stats.members}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Last activity">
                    <Clock size={13} />
                    <span>{formatDate(company.stats.lastActivity)}</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-edge flex items-center gap-2">
                <button
                  onClick={() => handleViewAs(company)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-surface text-muted border border-edge hover:bg-teal/10 hover:text-teal hover:border-teal/30 transition-all"
                >
                  <LogIn size={14} />
                  View as
                </button>
                <Button
                  size="sm"
                  variant={company.subscription?.plan_slug === 'lifetime' ? 'ghost' : 'secondary'}
                  leftIcon={Crown}
                  loading={granting === company.id}
                  onClick={() => handleToggleLifetime(company)}
                  title={
                    company.subscription?.plan_slug === 'lifetime'
                      ? 'Revoke lifetime access'
                      : 'Grant lifetime access'
                  }
                >
                  {company.subscription?.plan_slug === 'lifetime' ? 'Revoke' : 'Lifetime'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchCompanies();
            onMetricsChange();
          }}
        />
      )}
    </div>
  );
}

function SubBadge({ subscription }: { subscription: CompanyWithStats['subscription'] }) {
  if (!subscription) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold bg-surface text-faint border border-edge shrink-0">
        <AlertCircle size={10} />
        No sub
      </span>
    );
  }
  if (subscription.plan_slug === 'lifetime') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
        <Crown size={10} />
        Lifetime
      </span>
    );
  }
  const colors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    trialing: 'bg-sky-50 text-sky-700 border-sky-200',
    past_due: 'bg-red-50 text-red-700 border-red-200',
    canceled: 'bg-surface text-faint border-edge',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold border shrink-0 ${colors[subscription.status] || colors.canceled}`}>
      <ShieldCheck size={10} />
      {subscription.status}
    </span>
  );
}

function CreateAccountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [grantLifetime, setGrantLifetime] = useState(true);
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
        .slice(0, 40),
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Not authenticated'); setSaving(false); return; }

    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim(),
        grant_lifetime: grantLifetime,
      }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create account');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-edge rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Account</h2>
          <button onClick={onClose} className="text-faint hover:text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Agency Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Agency"
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-agency"
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
          </div>

          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                grantLifetime
                  ? 'bg-teal border-teal'
                  : 'border-edge bg-white'
              }`}
              onClick={() => setGrantLifetime(!grantLifetime)}
            >
              {grantLifetime && <Check size={13} className="text-white" />}
            </div>
            <div>
              <div className="text-sm font-medium text-ink flex items-center gap-1.5">
                <Crown size={14} className="text-amber-500" />
                Grant lifetime access
              </div>
              <div className="text-xs text-faint">No trial, no billing — full access forever</div>
            </div>
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
}
