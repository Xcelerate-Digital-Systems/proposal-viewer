// app/accounts/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Plus, LogIn, Users, FileText, Clock,
  X, Loader2, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';

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
}

export default function AccountsPage() {
  return (
    <AdminLayout>
      {(auth) => {
        if (!auth.isSuperAdmin) {
          return (
            <div className="flex items-center justify-center h-screen">
              <p className="text-gray-400">Access denied</p>
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
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/admin/accounts', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCompanies(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleEnter = (company: CompanyWithStats) => {
    // Store override in localStorage — useAuth picks it up
    const override = JSON.stringify({ companyId: company.id, companyName: company.name });
    localStorage.setItem('super_admin_company_override', override);
    // Navigate to proposals dashboard — forces re-render with new company context
    window.location.href = '/';
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
          <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">
            Accounts
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companies.length} account{companies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#017C87] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
        >
          <Plus size={16} />
          New Account
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-500 mb-1">No accounts yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first client account to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-[#017C87] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
          >
            <Plus size={16} />
            New Account
          </button>
        </div>
      ) : (
        /* Company cards */
        <div className="grid gap-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-5 hover:border-gray-300 shadow-sm transition-colors group"
            >
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

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{company.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{company.slug}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1.5" title="Proposals">
                  <FileText size={13} className="text-gray-300" />
                  <span>{company.stats.proposals}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Team members">
                  <Users size={13} className="text-gray-300" />
                  <span>{company.stats.members}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-[80px]" title="Last activity">
                  <Clock size={13} className="text-gray-300" />
                  <span>{formatDate(company.stats.lastActivity)}</span>
                </div>
              </div>

              {/* Enter button */}
              <button
                onClick={() => handleEnter(company)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  bg-gray-50 text-gray-500 border border-gray-200
                  hover:bg-[#017C87]/10 hover:text-[#017C87] hover:border-[#017C87]/30
                  transition-all"
              >
                <LogIn size={14} />
                Enter
              </button>
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

  // Auto-generate slug from name
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
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Plumbing"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-plumbing"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
            />
            <p className="text-xs text-gray-400 mt-1">Used for internal identification</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !slug.trim() || saving}
            className="flex items-center gap-2 bg-[#017C87] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}