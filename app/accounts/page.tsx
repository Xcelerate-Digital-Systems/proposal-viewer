// app/accounts/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Plus, LogIn, Users, FileText, Clock,
  X, Loader2, ExternalLink, UserPlus, Check, Crown, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

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

export default function AccountsPage() {
  return (
    <AdminLayout>
      {(auth) => {
        if (!auth.isSuperAdmin) {
          return (
            <div className="flex items-center justify-center h-screen">
              <p className="text-faint">Access denied</p>
            </div>
          );
        }
        return <AccountsContent />;
      }}
    </AdminLayout>
  );
}

function AccountsContent() {
  const router = useRouter();
  const toast = useToast();
  const { memberships, setActiveMembership } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [granting, setGranting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Lookup: company_id → membership_id, so "Join" turns into "Switch" once
  // the platform admin has actually joined the workspace.
  const membershipByCompanyId = new Map(
    memberships.map((m) => [m.company_id, m.id] as const),
  );

  const fetchCompanies = useCallback(async () => {
    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Failed to load accounts (${res.status})`);
      const data = await res.json();
      setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleEnter = (company: CompanyWithStats) => {
    // If the platform admin is already a real member of this workspace,
    // switch via the proper membership path so role + permissions reflect
    // the workspace (not an override). Otherwise fall back to "view as".
    const existingMembershipId = membershipByCompanyId.get(company.id);
    if (existingMembershipId) {
      setActiveMembership(existingMembershipId).then(() => {
        window.location.href = '/';
      });
      return;
    }
    const override = JSON.stringify({ companyId: company.id, companyName: company.name });
    localStorage.setItem('company_override', override);
    localStorage.removeItem('super_admin_company_override'); // legacy key cleanup
    window.location.href = '/';
  };

  const handleJoin = async (company: CompanyWithStats) => {
    setJoining(company.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setJoining(null); return; }
      const res = await fetch('/api/admin/join-as-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_id: company.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to join workspace');
        setJoining(null);
        return;
      }
      // Hard nav so useAuth re-pulls the membership list and lands inside
      // the new workspace via active_membership_id localStorage.
      try {
        localStorage.setItem('active_membership_id', json.membership.id);
        localStorage.removeItem('company_override');
      } catch {}
      toast.success(
        json.already_member
          ? `Already a member of ${company.name} — switching in`
          : `Joined ${company.name}`,
      );
      window.location.href = '/';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join workspace');
      setJoining(null);
    }
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
        toast.success(isLifetime ? `Revoked lifetime access for ${company.name}` : `Granted lifetime access to ${company.name}`);
        fetchCompanies();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setGranting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No activity';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="px-6 lg:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-ink font-[family-name:var(--font-display)]">
            Accounts
          </h1>
          <p className="text-sm text-faint mt-0.5">
            {companies.length} account{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          leftIcon={Plus}
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          New Account
        </Button>
      </div>

      {/* Loading / Error / Content */}
      {loading ? (
        <EntityListSkeleton viewMode="grid" />
      ) : fetchError ? (
        <ErrorState
          description={fetchError}
          onRetry={() => { setLoading(true); fetchCompanies(); }}
        />
      ) : companies.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-faint" />
          </div>
          <h3 className="text-lg font-semibold text-muted mb-1">No accounts yet</h3>
          <p className="text-sm text-faint mb-6">Create your first client account to get started.</p>
          <Button
            leftIcon={Plus}
            onClick={() => setShowCreate(true)}
          >
            New Account
          </Button>
        </div>
      ) : (
        /* Company card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white border border-edge rounded-[14px]    transition-all group flex flex-col"
            >
              {/* Card header */}
              <div className="p-5 flex-1">
                <div className="flex items-start gap-3.5 mb-4">
                  {/* Logo / initial */}
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
                      {company.subscription?.plan_slug === 'lifetime' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          <Crown size={10} />
                          Lifetime
                        </span>
                      )}
                      {company.subscription && company.subscription.plan_slug !== 'lifetime' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-detail font-semibold bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                          <ShieldCheck size={10} />
                          {company.subscription.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-faint truncate mt-0.5">{company.slug}</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-faint">
                  <div className="flex items-center gap-1.5" title="Proposals">
                    <FileText size={13} className="text-faint" />
                    <span>{company.stats.proposals}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Team members">
                    <Users size={13} className="text-faint" />
                    <span>{company.stats.members}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Last activity">
                    <Clock size={13} className="text-faint" />
                    <span>{formatDate(company.stats.lastActivity)}</span>
                  </div>
                </div>
              </div>

              {/* Card footer — Enter Account always available; "Join" is
                  only offered when not already a member, otherwise we show
                  a small "Member" pill to make the state obvious. */}
              <div className="px-5 py-3 border-t border-edge flex items-center gap-2">
                <button
                  onClick={() => handleEnter(company)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    bg-surface text-muted border border-edge
                    hover:bg-teal/10 hover:text-teal hover:border-teal/30
                    transition-all"
                >
                  <LogIn size={14} />
                  {membershipByCompanyId.has(company.id) ? 'Open workspace' : 'View as'}
                </button>
                {membershipByCompanyId.has(company.id) ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-detail font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                    title="You're a member of this workspace"
                  >
                    <Check size={12} />
                    Member
                  </span>
                ) : (
                  <Button
                    size="sm"
                    leftIcon={UserPlus}
                    loading={joining === company.id}
                    onClick={() => handleJoin(company)}
                    title="Add yourself as an admin of this workspace"
                  >
                    Join
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={company.subscription?.plan_slug === 'lifetime' ? 'ghost' : 'secondary'}
                  leftIcon={Crown}
                  loading={granting === company.id}
                  onClick={() => handleToggleLifetime(company)}
                  title={company.subscription?.plan_slug === 'lifetime' ? 'Revoke lifetime access' : 'Grant lifetime access'}
                >
                  {company.subscription?.plan_slug === 'lifetime' ? 'Revoke' : 'Lifetime'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchCompanies();
          }}
        />
      )}
    </div>
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

    const res = await fetch('/api/admin/accounts', {
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
      setError(data.error || 'Failed to create account');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white border border-edge rounded-2xl shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Account</h2>
          <button onClick={onClose} className="text-faint hover:text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Plumbing"
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 /40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-plumbing"
              className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 /40"
            />
            <p className="text-xs text-faint mt-1">Used for internal identification</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-edge">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
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