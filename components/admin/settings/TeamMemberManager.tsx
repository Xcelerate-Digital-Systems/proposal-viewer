// components/admin/settings/TeamMemberManager.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, User, Camera, Trash2, Loader2, Check, Crown, Shield,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  avatar_path: string | null;
  avatar_url: string | null;
}

interface TeamMemberManagerProps {
  companyId: string;
  currentMemberId: string;
  currentRole: string;
  isSuperAdmin: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'owner':
      return <Crown size={12} className="text-teal" />;
    case 'admin':
      return <Shield size={12} className="text-teal/70" />;
    default:
      return <User size={12} className="text-faint" />;
  }
};

const getRoleBadge = (role: string) => {
  const styles: Record<string, string> = {
    owner: 'bg-teal/10 text-teal border-teal/20',
    admin: 'bg-teal/5 text-teal border-teal/10',
    member: 'bg-surface text-muted border-edge',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles[role] || styles.member}`}
    >
      {getRoleIcon(role)}
      <span className="capitalize">{role}</span>
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Individual member editor row                                       */
/* ------------------------------------------------------------------ */

function MemberRow({
  member,
  companyId,
  canEdit,
  isCurrentUser,
  onUpdated,
}: {
  member: TeamMemberItem;
  companyId: string;
  canEdit: boolean;
  isCurrentUser: boolean;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameChanged = name !== member.name;

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    };
  };

  const buildUrl = (path: string) => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}company_id=${companyId}`;
  };

  /* ── Save name ─────────────────────────────────────────── */
  const handleSaveName = async () => {
    if (!name.trim() || !nameChanged) return;
    setSavingName(true);
    const headers = await getAuthHeaders();
    const res = await fetch(buildUrl(`/api/team/${member.id}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      onUpdated();
    }
    setSavingName(false);
  };

  /* ── Avatar upload ─────────────────────────────────────── */
  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `avatars/${companyId}/${member.id}-${Date.now()}.${ext}`;

    // Remove old avatar if exists
    if (member.avatar_path) {
      await supabase.storage.from('proposals').remove([member.avatar_path]);
    }

    const { error } = await supabase.storage
      .from('proposals')
      .upload(filePath, file, { contentType: file.type, upsert: true });

    if (!error) {
      // Update via API
      const headers = await getAuthHeaders();
      await fetch(buildUrl(`/api/team/${member.id}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ avatar_path: filePath }),
      });

      // Get signed URL for display
      const { data } = await supabase.storage
        .from('proposals')
        .createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);

      onUpdated();
    }
    setUploading(false);
  };

  /* ── Avatar remove ─────────────────────────────────────── */
  const handleRemoveAvatar = async () => {
    if (member.avatar_path) {
      await supabase.storage.from('proposals').remove([member.avatar_path]);
    }
    setAvatarUrl(null);

    const headers = await getAuthHeaders();
    await fetch(buildUrl(`/api/team/${member.id}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ avatar_path: null }),
    });

    onUpdated();
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="relative group">
          {avatarUrl ? (
            <div className="relative">
              <img
                src={avatarUrl}
                alt={member.name}
                className="w-10 h-10 rounded-full object-cover border border-edge"
              />
              {canEdit && (
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="p-1 text-white hover:text-white/70 transition-colors"
                    title="Change photo"
                  >
                    <Camera size={12} />
                  </button>
                  <button
                    onClick={handleRemoveAvatar}
                    className="p-1 text-white hover:text-red-300 transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ) : canEdit ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-10 h-10 rounded-full border-2 border-dashed border-edge flex items-center justify-center text-faint hover:border-teal/30 hover:text-teal transition-colors disabled:opacity-50"
              title="Upload photo"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <User size={16} />
              )}
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface border border-edge flex items-center justify-center">
              <span className="text-sm font-medium text-faint">
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {canEdit && (
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
              }}
            />
          )}
        </div>
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            {nameChanged && (
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="shrink-0 px-3 py-1.5 bg-teal text-white text-xs rounded-md hover:bg-teal-hover disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {savingName ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Save
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium text-ink truncate">{member.name}</p>
        )}
        <p className="text-xs text-faint truncate mt-0.5">{member.email}</p>
      </div>

      {/* Role badge + current user tag */}
      <div className="shrink-0 flex items-center gap-2">
        {getRoleBadge(member.role)}
        {isCurrentUser && (
          <span className="text-[10px] text-faint font-medium">(you)</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TeamMemberManager({
  companyId,
  currentMemberId,
  currentRole,
  isSuperAdmin,
}: TeamMemberManagerProps) {
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin';

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name, email, role, avatar_path')
      .eq('company_id', companyId)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      const withUrls = await Promise.all(
        data.map(async (m) => {
          let avatar_url: string | null = null;
          if (m.avatar_path) {
            const { data: urlData } = await supabase.storage
              .from('proposals')
              .createSignedUrl(m.avatar_path, 3600);
            avatar_url = urlData?.signedUrl || null;
          }
          return { ...m, avatar_url } as TeamMemberItem;
        })
      );
      setMembers(withUrls);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  /* ── Permission check: can current user edit this member? ── */
  const canEditMember = (targetMember: TeamMemberItem) => {
    // Can't edit yourself here (use the Profile section above)
    if (targetMember.id === currentMemberId) return false;

    // Super admins and owners can edit anyone
    if (isSuperAdmin || isOwner) return true;

    // Admins can edit members only (not owners or other admins)
    if (isAdmin && targetMember.role === 'member') return true;

    return false;
  };

  // Filter out the current user from the list (they edit themselves via the Profile section)
  const otherMembers = members.filter((m) => m.id !== currentMemberId);

  if (otherMembers.length === 0 && !loading) return null;

  return (
    <div className="mt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-4 group"
      >
        <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center">
          <Users size={16} className="text-teal" />
        </div>
        <div className="text-left">
          <h2 className="text-sm font-semibold text-ink">Team Profiles</h2>
          <p className="text-xs text-faint">
            Update names and photos for your team members
          </p>
        </div>
        <div className="ml-auto text-faint group-hover:text-faint transition-colors">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-faint" />
            </div>
          ) : (
            <div className="bg-white border border-edge rounded-[14px] overflow-hidden  divide-y divide-edge">
              {otherMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  companyId={companyId}
                  canEdit={canEditMember(m)}
                  isCurrentUser={m.id === currentMemberId}
                  onUpdated={fetchMembers}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}