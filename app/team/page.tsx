// app/team/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Crown, Shield, User, MoreVertical,
  Loader2, Trash2, ChevronDown,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { InviteManager } from '@/components/admin/InviteManager';
import { supabase } from '@/lib/supabase';

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
};

type CompanyInfo = {
  id: string;
  name: string;
  slug: string;
};

export default function TeamPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <TeamContent
          currentRole={auth.teamMember?.role || 'member'}
        />
      )}
    </AdminLayout>
  );
}

function TeamContent({
  currentRole,
}: {
  currentRole: string;
}) {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin';
  const canManage = isOwner || isAdmin;

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    };
  };

  const fetchTeam = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/team', { headers });
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
        setCompany(data.company);
        setCurrentMemberId(data.current_member_id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    setActionLoading(memberId);
    setActionMenuId(null);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/team/${memberId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setMembers(prev =>
        prev.map(m => m.id === memberId ? { ...m, role: newRole } : m)
      );
    }
    setActionLoading(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    setActionLoading(memberId);
    setActionMenuId(null);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/team/${memberId}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
    setActionLoading(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown size={14} className="text-[#017C87]" />;
      case 'admin': return <Shield size={14} className="text-[#017C87]/70" />;
      default: return <User size={14} className="text-gray-400" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      owner: 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]/20',
      admin: 'bg-[#017C87]/5 text-[#017C87] border-[#017C87]/10',
      member: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${styles[role] || styles.member}`}>
        {getRoleIcon(role)}
        <span className="capitalize">{role}</span>
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="px-6 lg:px-10 py-8 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#017C87]/10 rounded-xl flex items-center justify-center">
          <Users size={20} className="text-[#017C87]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          {company && (
            <p className="text-sm text-gray-400">{company.name}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Members List */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Members ({members.length})
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
              {members.map((m) => {
                const isCurrentUser = m.id === currentMemberId;
                const canEditThis = canManage && !isCurrentUser && m.role !== 'owner';
                const showMenu = actionMenuId === m.id;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-5 py-4 relative"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center shrink-0 border border-gray-200">
                        <span className="text-sm font-medium text-gray-500">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.name}
                            {isCurrentUser && (
                              <span className="text-xs text-gray-300 ml-1.5">(you)</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {getRoleBadge(m.role)}

                      {actionLoading === m.id ? (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Loader2 size={14} className="animate-spin text-gray-300" />
                        </div>
                      ) : canEditThis ? (
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(showMenu ? null : m.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {showMenu && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActionMenuId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                                {isOwner && (
                                  <>
                                    {m.role !== 'admin' && (
                                      <button
                                        onClick={() => handleChangeRole(m.id, 'admin')}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-2"
                                      >
                                        <Shield size={14} />
                                        Make Admin
                                      </button>
                                    )}
                                    {m.role !== 'member' && (
                                      <button
                                        onClick={() => handleChangeRole(m.id, 'member')}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-2"
                                      >
                                        <User size={14} />
                                        Make Member
                                      </button>
                                    )}
                                    <div className="border-t border-gray-100 my-1" />
                                  </>
                                )}
                                <button
                                  onClick={() => handleRemoveMember(m.id)}
                                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  Remove
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invite Section - only for owners/admins */}
          {canManage && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Invites</h2>
              <InviteManager />
            </div>
          )}

          {/* Role Legend */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Role Permissions</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{getRoleBadge('owner')}</div>
                <p className="text-gray-400">Full access. Can manage team, change roles, delete company, and manage all proposals.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{getRoleBadge('admin')}</div>
                <p className="text-gray-400">Can invite members, remove members, and manage all proposals.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{getRoleBadge('member')}</div>
                <p className="text-gray-400">Can view and manage proposals. Cannot manage team or invites.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}