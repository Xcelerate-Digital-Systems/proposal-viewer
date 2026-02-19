// components/admin/InviteManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, X, Clock, Loader2, Link2 } from 'lucide-react';
import { useInvites, CompanyInvite } from '@/hooks/useInvites';

export function InviteManager() {
  const {
    pendingInvites,
    acceptedInvites,
    expiredInvites,
    loading,
    fetchInvites,
    createInvite,
    revokeInvite,
  } = useInvites();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-[#ff6700]" />
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
              className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white focus:outline-none focus:border-[#ff6700]/50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">{success}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6700] text-white text-sm font-medium rounded-lg hover:bg-[#e85d00] disabled:opacity-50 transition-colors"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Generate Invite Link
          </button>
        </form>

        <p className="text-xs text-[#555] mt-3">
          Invites expire after 7 days. The recipient must sign up with the invited email.
        </p>
      </div>

      {/* Pending Invites */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[#555]" />
        </div>
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#999] mb-3">
                Pending Invites ({pendingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{invite.email}</p>
                      <p className="text-xs text-[#666] mt-0.5">
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
                        className="p-1.5 rounded-md hover:bg-[#2a2a2a] text-[#999] hover:text-white transition-colors"
                        title="Copy invite link"
                      >
                        {copiedId === invite.id ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Link2 size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-[#999] hover:text-red-400 transition-colors"
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
              <h3 className="text-sm font-medium text-[#999] mb-3">
                Accepted ({acceptedInvites.length})
              </h3>
              <div className="space-y-2">
                {acceptedInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-[#999] truncate">{invite.email}</p>
                      <p className="text-xs text-[#555] mt-0.5">
                        <span className="capitalize">{invite.role}</span>
                        {' · '}
                        Accepted {formatDate(invite.accepted_at!)}
                      </p>
                    </div>
                    <Check size={14} className="text-green-400/60" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiredInvites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#999] mb-3">
                Expired ({expiredInvites.length})
              </h3>
              <div className="space-y-2">
                {expiredInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between bg-[#1a1a1a]/30 border border-[#2a2a2a]/30 rounded-lg px-4 py-3 opacity-60"
                  >
                    <div>
                      <p className="text-sm text-[#666] truncate">{invite.email}</p>
                      <p className="text-xs text-[#555] mt-0.5">
                        <span className="capitalize">{invite.role}</span>
                        {' · '}
                        Expired {formatDate(invite.expires_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-[#555] hover:text-red-400 transition-colors"
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