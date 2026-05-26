// components/admin/settings/MembersTab.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Crown, Shield, User, MoreVertical, Loader2, Trash2,
  Camera, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { InviteManager } from '@/components/admin/InviteManager';

type Role = 'owner' | 'admin' | 'member';

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_path: string | null;
  avatar_url: string | null;
  created_at: string;
};

interface MembersTabProps {
  companyId: string;
  currentMemberId: string;
  currentRole: Role | string;
  isSuperAdmin: boolean;
  accountType: 'agency' | 'client';
}

function roleIcon(role: string) {
  switch (role) {
    case 'owner':  return <Crown size={14} className="text-teal" />;
    case 'admin':  return <Shield size={14} className="text-teal/70" />;
    default:       return <User size={14} className="text-faint" />;
  }
}

function roleLabel(role: string, accountType: 'agency' | 'client') {
  const prefix = accountType === 'client' ? 'Client' : 'Agency';
  switch (role) {
    case 'owner':  return `${prefix} Owner`;
    case 'admin':  return `${prefix} Admin`;
    default:       return `${prefix} Member`;
  }
}

function RoleBadge({ role, accountType }: { role: string; accountType: 'agency' | 'client' }) {
  const styles: Record<string, string> = {
    owner:  'bg-teal/10 text-teal border-teal/20',
    admin:  'bg-teal/5 text-teal border-teal/10',
    member: 'bg-surface text-muted border-edge',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${styles[role] || styles.member}`}
    >
      {roleIcon(role)}
      <span>{roleLabel(role, accountType)}</span>
    </span>
  );
}

export default function MembersTab({
  companyId,
  currentMemberId,
  currentRole,
  isSuperAdmin,
  accountType,
}: MembersTabProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin';
  const canManage = isOwner || isAdmin || isSuperAdmin;

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    };
  };

  const buildUrl = (path: string) => {
    if (!companyId) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}company_id=${companyId}`;
  };

  const fetchMembers = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch(buildUrl('/api/team'), { headers });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      return;
    }
    // Hydrate avatar URLs via storage. The /api/team list doesn't include
    // avatar_path today, so fetch the full rows via service-role-flavoured
    // signed URLs in a second pass.
    const raw = (data.members || []) as Array<{
      id: string; name: string; email: string; role: Role; created_at: string;
    }>;

    // Fetch avatar_paths in one go via the anon client — we have read access
    // to team_members rows we belong to, but for super-admin override the
    // anon client is blocked. Fall back to empty avatars in that case.
    let pathsById = new Map<string, string | null>();
    if (raw.length > 0) {
      const { data: rows } = await supabase
        .from('team_members')
        .select('id, avatar_path')
        .in('id', raw.map(r => r.id));
      pathsById = new Map((rows ?? []).map(r => [r.id, r.avatar_path]));
    }

    const hydrated: MemberRow[] = await Promise.all(
      raw.map(async r => {
        const path = pathsById.get(r.id) ?? null;
        let url: string | null = null;
        if (path) {
          const { data: signed } = await supabase.storage
            .from('proposals')
            .createSignedUrl(path, 3600);
          url = signed?.signedUrl ?? null;
        }
        return { ...r, avatar_path: path, avatar_url: url };
      })
    );
    setMembers(hydrated);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const patchMember = async (memberId: string, body: Record<string, unknown>) => {
    const headers = await authHeaders();
    return fetch(buildUrl(`/api/team/${memberId}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  };

  const handleChangeRole = async (memberId: string, newRole: Role) => {
    setActionLoading(memberId);
    setActionMenuId(null);
    const res = await patchMember(memberId, { role: newRole });
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    }
    setActionLoading(null);
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    setActionLoading(memberId);
    setActionMenuId(null);
    const headers = await authHeaders();
    const res = await fetch(buildUrl(`/api/team/${memberId}`), {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
    setActionLoading(null);
  };

  const handleNameSave = async (memberId: string, newName: string) => {
    const res = await patchMember(memberId, { name: newName.trim() });
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, name: newName.trim() } : m));
    }
  };

  const handleAvatarUpload = async (member: MemberRow, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `avatars/${companyId}/${member.id}-${Date.now()}.${ext}`;
    if (member.avatar_path) {
      await supabase.storage.from('proposals').remove([member.avatar_path]);
    }
    const { error } = await supabase.storage
      .from('proposals')
      .upload(filePath, file, { contentType: file.type, upsert: true });
    if (error) return;
    await patchMember(member.id, { avatar_path: filePath });
    const { data: signed } = await supabase.storage
      .from('proposals')
      .createSignedUrl(filePath, 3600);
    setMembers(prev => prev.map(m => m.id === member.id
      ? { ...m, avatar_path: filePath, avatar_url: signed?.signedUrl ?? null }
      : m));
  };

  const handleAvatarRemove = async (member: MemberRow) => {
    if (member.avatar_path) {
      await supabase.storage.from('proposals').remove([member.avatar_path]);
    }
    await patchMember(member.id, { avatar_path: null });
    setMembers(prev => prev.map(m => m.id === member.id
      ? { ...m, avatar_path: null, avatar_url: null }
      : m));
  };

  const roleLegend = accountType === 'client'
    ? {
        owner:  'Full access to this client account. Can manage team, change roles, and manage all proposals and documents.',
        admin:  'Can invite members, remove members, and manage all proposals and documents.',
        member: 'Can view and manage proposals and documents. Cannot manage team or invites.',
      }
    : {
        owner:  'Full access. Can manage team, change roles, and manage all proposals, templates, and Feedback projects.',
        admin:  'Can invite members, remove members, and manage all proposals, templates, and Feedback projects.',
        member: 'Can view and manage proposals. Cannot manage team or invites.',
      };

  return (
    <div className="space-y-8">
      {/* Members list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted">
            Members ({members.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 bg-white border border-edge rounded-[14px]">
            <Loader2 size={20} className="animate-spin text-faint" />
          </div>
        ) : (
          <div className="bg-white border border-edge rounded-[14px] overflow-hidden divide-y divide-edge">
            {members.map(m => {
              const isCurrentUser = m.id === currentMemberId;
              const canEditProfile =
                isSuperAdmin ||
                isCurrentUser ||
                (canManage && !isCurrentUser && (isOwner || isSuperAdmin || (isAdmin && m.role === 'member')));
              const canEditRoleOrRemove =
                canManage &&
                !isCurrentUser &&
                (isOwner || isSuperAdmin || (isAdmin && m.role === 'member'));
              const showMenu = actionMenuId === m.id;

              return (
                <MemberRowItem
                  key={m.id}
                  member={m}
                  isCurrentUser={isCurrentUser}
                  canEditProfile={canEditProfile}
                  canEditRoleOrRemove={canEditRoleOrRemove}
                  actionLoading={actionLoading === m.id}
                  showMenu={showMenu}
                  isOwner={isOwner}
                  isSuperAdmin={isSuperAdmin}
                  accountType={accountType}
                  onToggleMenu={() => setActionMenuId(showMenu ? null : m.id)}
                  onCloseMenu={() => setActionMenuId(null)}
                  onChangeRole={(role) => handleChangeRole(m.id, role)}
                  onRemove={() => handleRemove(m.id)}
                  onNameSave={(name) => handleNameSave(m.id, name)}
                  onAvatarUpload={(file) => handleAvatarUpload(m, file)}
                  onAvatarRemove={() => handleAvatarRemove(m)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Invite Section */}
      {canManage && (
        <section>
          <h2 className="text-sm font-medium text-muted mb-3">Invites</h2>
          <InviteManager
            companyId={companyId}
            currentRole={String(currentRole)}
            isSuperAdmin={isSuperAdmin}
          />
        </section>
      )}

      {/* Role legend */}
      <section className="bg-white border border-edge rounded-[14px] p-5">
        <h3 className="text-sm font-medium text-muted mb-3">Role Permissions</h3>
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5"><RoleBadge role="owner" accountType={accountType} /></div>
            <p className="text-faint">{roleLegend.owner}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5"><RoleBadge role="admin" accountType={accountType} /></div>
            <p className="text-faint">{roleLegend.admin}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5"><RoleBadge role="member" accountType={accountType} /></div>
            <p className="text-faint">{roleLegend.member}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-member row                                                     */
/* ------------------------------------------------------------------ */

function MemberRowItem({
  member,
  isCurrentUser,
  canEditProfile,
  canEditRoleOrRemove,
  actionLoading,
  showMenu,
  isOwner,
  isSuperAdmin,
  accountType,
  onToggleMenu,
  onCloseMenu,
  onChangeRole,
  onRemove,
  onNameSave,
  onAvatarUpload,
  onAvatarRemove,
}: {
  member: MemberRow;
  isCurrentUser: boolean;
  canEditProfile: boolean;
  canEditRoleOrRemove: boolean;
  actionLoading: boolean;
  showMenu: boolean;
  isOwner: boolean;
  isSuperAdmin: boolean;
  accountType: 'agency' | 'client';
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onChangeRole: (role: Role) => void;
  onRemove: () => void;
  onNameSave: (name: string) => void;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(member.name); }, [member.name]);

  const nameChanged = name.trim() !== member.name && name.trim().length > 0;

  const handleSaveName = async () => {
    setSavingName(true);
    await onNameSave(name);
    setSavingName(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onAvatarUpload(file);
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4 relative">
      {/* Avatar */}
      <div className="relative group shrink-0">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.name}
            className="w-10 h-10 rounded-full object-cover border border-edge"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface border border-edge flex items-center justify-center">
            <span className="text-sm font-medium text-muted">
              {member.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {canEditProfile && (
          <>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="p-1 text-white hover:text-white/70"
                title="Change photo"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
              {member.avatar_url && (
                <button
                  onClick={onAvatarRemove}
                  className="p-1 text-white hover:text-red-300"
                  title="Remove photo"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        {canEditProfile ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
            {nameChanged && (
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="shrink-0 px-3 py-1.5 bg-teal text-white text-xs rounded-md hover:bg-teal-hover disabled:opacity-50 flex items-center gap-1"
              >
                {savingName ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            )}
            {isCurrentUser && (
              <span className="text-2xs text-faint font-medium shrink-0">(you)</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink truncate">{member.name}</p>
            {isCurrentUser && <span className="text-xs text-faint">(you)</span>}
          </div>
        )}
        <p className="text-xs text-faint truncate mt-0.5">{member.email}</p>
      </div>

      {/* Role + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <RoleBadge role={member.role} accountType={accountType} />
        {actionLoading ? (
          <div className="w-8 h-8 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-faint" />
          </div>
        ) : canEditRoleOrRemove ? (
          <div className="relative">
            <button
              onClick={onToggleMenu}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface text-faint hover:text-muted transition-colors"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-edge rounded-lg shadow-lg py-1 min-w-[160px]">
                  {(isOwner || isSuperAdmin) && (
                    <>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => onChangeRole('owner')}
                          className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink flex items-center gap-2"
                        >
                          <Crown size={14} />
                          Make Owner
                        </button>
                      )}
                      {member.role !== 'admin' && (
                        <button
                          onClick={() => onChangeRole('admin')}
                          className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink flex items-center gap-2"
                        >
                          <Shield size={14} />
                          Make Admin
                        </button>
                      )}
                      {member.role !== 'member' && (
                        <button
                          onClick={() => onChangeRole('member')}
                          className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink flex items-center gap-2"
                        >
                          <User size={14} />
                          Make Member
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                    </>
                  )}
                  <button
                    onClick={onRemove}
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
}
