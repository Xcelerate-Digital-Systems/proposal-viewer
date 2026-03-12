// components/admin/InviteManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, X, Clock, Loader2, Link2 } from 'lucide-react';
import { useInvites, CompanyInvite } from '@/hooks/useInvites';

interface InviteManagerProps {
  companyId?: string;
  currentRole?: string;
  isSuperAdmin?: boolean;
}

export function InviteManager({ companyId, currentRole, isSuperAdmin }: InviteManagerProps) {
  const {
    pendingInvites,
    acceptedInvites,
    expiredInvites,
    loading,
    fetchInvites,
    createInvite,
    revokeInvite,
  } = useInvites(companyId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Can this user invite owners?
  const canInviteOwner = isSuperAdmin || currentRole === 'owner';

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setSuccess('');
    setSending(true);

    const { error, data } = await createInvite(email.trim(), role);
    if (error) {
      setError(error);
    } else if (data) {
      setSuccess(`Invite sent! Share this link: ${data.invite_url}`);
      setEmail('');
      setRole('member');
    }
    setSending(false);
  };

  const handleCopyLink = async (invite: CompanyInvite) => {
    const url = `${window.location.origin}/login?invite=${invite.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (inviteId: string) => {
    await revokeInvite(inviteId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysUntilExpiry = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-6">
      {/* Send Invite Form */}
      <div className="bg-white border border-edge rounded-[14px] p-5 ">
        <h3 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-teal" />
          Invite Team Member
        </h3>

        <form onSubmit={handleSendInvite} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'owner' | 'admin' | 'member')}
              className="px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            >
              {canInviteOwner && <option value="owner">Owner</option>}
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">{success}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-hover disabled:opacity-50 transition-colors"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Generate Invite Link
          </button>
        </form>

        <p className="text-xs text-faint mt-3">
          Invites expire after 7 days. The recipient must sign up with the invited email.
        </p>
      </div>

      {/* Pending Invites */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-faint" />
        </div>
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-3">
                Pending Invites ({pendingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-white border border-edge rounded-lg px-4 py-3 "
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{invite.email}</p>
                      <p className="text-xs text-faint mt-0.5">
                        <span className="capitalize">{invite.role}</span>
                        {' · '}
                        <Clock size={10} className="inline" />{' '}
                        {daysUntilExpiry(invite.expires_at)}d left
                        {invite.invited_by_member && (
                          <> · Invited by {(invite.invited_by_member as any).name}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <button
                        onClick={() => handleCopyLink(invite)}
                        className="p-1.5 rounded-md hover:bg-surface text-faint hover:text-muted transition-colors"
                        title="Copy invite link"
                      >
                        {copiedId === invite.id ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Link2 size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-faint hover:text-red-500 transition-colors"
                        title="Revoke invite"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {acceptedInvites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-3">
                Accepted ({acceptedInvites.length})
              </h3>
              <div className="space-y-2">
                {acceptedInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-surface border border-edge rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-muted truncate">{invite.email}</p>
                      <p className="text-xs text-faint mt-0.5">
                        <span className="capitalize">{invite.role}</span>
                        {' · '}
                        Accepted {formatDate(invite.accepted_at!)}
                      </p>
                    </div>
                    <Check size={14} className="text-emerald-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiredInvites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted mb-3">
                Expired ({expiredInvites.length})
              </h3>
              <div className="space-y-2">
                {expiredInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-surface/50 border border-edge rounded-lg px-4 py-3 opacity-60"
                  >
                    <div>
                      <p className="text-sm text-faint truncate">{invite.email}</p>
                      <p className="text-xs text-faint mt-0.5">
                        <span className="capitalize">{invite.role}</span>
                        {' · '}
                        Expired {formatDate(invite.expires_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-faint hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}