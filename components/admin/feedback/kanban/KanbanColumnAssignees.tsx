'use client';

// Avatar stack + `+` picker rendered in each Kanban column header. Lets the
// project owner scope which team members (and, for client_review, which guest
// emails) are subscribed to that stage. State is owned by the parent
// KanbanBoard so all columns share a single fetch and one source of truth.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Check, Mail, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';
import type { FeedbackStatus } from '@/lib/types/feedback';

export type StageMember = {
  team_member_id: string;
  name: string;
  email: string;
  stages: string[];
  /** Signed URL for the member's avatar image, if uploaded. Falls back to
   *  the coloured-initials avatar when null/undefined. */
  avatar_url?: string | null;
};
export type StageGuest = {
  email: string;
  name: string;
  stages: string[];
};
export type CompanyMember = {
  id: string;
  name: string | null;
  email: string;
  avatar_url?: string | null;
};
export type ProjectGuest = {
  email: string;
  name: string;
};

const GUEST_ELIGIBLE_STAGES: FeedbackStatus[] = ['client_review', 'approved', 'rejected'];

function initials(name: string, email: string): string {
  const source = (name || email || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(seed: string): string {
  // Stable deterministic tint per identifier.
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-violet-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** Tiny avatar: renders the uploaded image when available, falls back to
 *  initials on a deterministic colour. Used in the column avatar stack and
 *  inside the picker rows so member rows and their assigned-circle stay in
 *  sync visually. */
function Avatar({
  imageUrl, name, email, seed, size = 24, ring = false,
}: {
  imageUrl?: string | null;
  name: string;
  email: string;
  seed: string;
  size?: number;
  ring?: boolean;
}) {
  const sizeClass = `w-[${size}px] h-[${size}px]`;
  const ringClass = ring ? 'ring-2 ring-white' : '';
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={name || email}
        className={`${sizeClass} rounded-full object-cover ${ringClass}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full text-2xs font-semibold text-white flex items-center justify-center ${avatarColor(seed)} ${ringClass}`}
      style={{ width: size, height: size }}
    >
      {initials(name, email)}
    </div>
  );
}

interface KanbanColumnAssigneesProps {
  projectId: string;
  stage: FeedbackStatus;
  /** Members already assigned to this stage. */
  members: StageMember[];
  /** Guests already assigned to this stage. */
  guests: StageGuest[];
  /** All team members of the company — picker source. */
  companyMembers: CompanyMember[];
  /** Project-level guest pool (everyone who's commented on the project + the
   *  project's client_email + any manually-added recipients). Sourced from
   *  /api/campaigns/[id]/guests so the picker can offer existing
   *  contacts before falling back to free-form email entry. */
  projectGuests: ProjectGuest[];
  /** Called after any successful add/remove so the parent can re-fetch. */
  onChanged: () => void;
}

export default function KanbanColumnAssignees({
  projectId, stage, members, guests, companyMembers, projectGuests, onChanged,
}: KanbanColumnAssigneesProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Click-outside / Escape dismissal.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const assignedMemberIds = new Set(members.map((m) => m.team_member_id));
  const guestAllowed = (GUEST_ELIGIBLE_STAGES as string[]).includes(stage);

  const toggleMember = useCallback(async (memberId: string) => {
    if (busy) return;
    setBusy(true);
    const isAdding = !assignedMemberIds.has(memberId);
    try {
      const url = `/api/campaigns/${projectId}/stage-assignees`;
      const res = isAdding
        ? await authFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'member', stage, team_member_id: memberId }),
          })
        : await authFetch(
            `${url}?kind=member&stage=${stage}&team_member_id=${encodeURIComponent(memberId)}`,
            { method: 'DELETE' },
          );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update assignee');
    } finally {
      setBusy(false);
    }
  }, [busy, assignedMemberIds, projectId, stage, onChanged, toast]);

  const addGuestByEmail = useCallback(async (rawEmail: string, name?: string) => {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/campaigns/${projectId}/stage-assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'guest', stage, email, name: name || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      setGuestEmail('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add guest');
    } finally {
      setBusy(false);
    }
  }, [busy, projectId, stage, onChanged, toast]);

  const addGuest = useCallback(() => addGuestByEmail(guestEmail), [addGuestByEmail, guestEmail]);

  const removeGuest = useCallback(async (email: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await authFetch(
        `/api/campaigns/${projectId}/stage-assignees?kind=guest&stage=${stage}&email=${encodeURIComponent(email)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove guest');
    } finally {
      setBusy(false);
    }
  }, [busy, projectId, stage, onChanged, toast]);

  const visibleAvatars = [...members, ...guests].slice(0, 4);
  const hiddenCount = members.length + guests.length - visibleAvatars.length;

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Avatar stack */}
      {visibleAvatars.length > 0 && (
        <div className="flex -space-x-1.5">
          {visibleAvatars.map((entry, i) => {
            const isGuest = !('team_member_id' in entry);
            const seed = isGuest ? entry.email : (entry as StageMember).team_member_id;
            const label = isGuest
              ? (entry.name || entry.email)
              : ((entry as StageMember).name || (entry as StageMember).email);
            const imageUrl = !isGuest ? (entry as StageMember).avatar_url ?? null : null;
            return (
              <div key={`${isGuest ? 'g' : 'm'}-${seed}-${i}`} title={`${label}${isGuest ? ' (guest)' : ''}`}>
                <Avatar
                  imageUrl={imageUrl}
                  name={label}
                  email={isGuest ? entry.email : (entry as StageMember).email}
                  seed={seed}
                  size={24}
                  ring
                />
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="w-6 h-6 rounded-full bg-gray-200 text-2xs font-semibold text-prose flex items-center justify-center ring-2 ring-white">
              +{hiddenCount}
            </div>
          )}
        </div>
      )}

      {/* + button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-6 h-6 rounded-full border border-dashed border-gray-300 text-faint hover:text-prose hover:border-gray-500 transition-colors flex items-center justify-center"
        aria-label={`Add reviewer to ${stage}`}
      >
        <Plus size={13} />
      </button>

      {/* Picker popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-8 left-0 z-30 w-64 rounded-2xl border border-edge-strong bg-white shadow-lg p-2"
        >
          <div className="text-detail font-semibold uppercase tracking-wider text-faint px-2 pb-1 pt-0.5">
            Team
          </div>
          <div className="max-h-56 overflow-y-auto -mx-1 px-1">
            {companyMembers.length === 0 ? (
              <div className="text-xs text-faint italic px-2 py-1">No team members yet.</div>
            ) : (
              companyMembers.map((m) => {
                const assigned = assignedMemberIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    disabled={busy}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface disabled:opacity-50"
                  >
                    <Avatar
                      imageUrl={m.avatar_url}
                      name={m.name ?? ''}
                      email={m.email}
                      seed={m.id}
                      size={24}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-caption text-gray-800 truncate">{m.name || m.email}</div>
                      {m.name && <div className="text-detail text-faint truncate">{m.email}</div>}
                    </div>
                    {assigned && <Check size={14} className="text-emerald-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {guestAllowed && (
            <>
              <div className="text-detail font-semibold uppercase tracking-wider text-faint px-2 pb-1 pt-2">
                Guests
              </div>

              {/* Project guest pool — emails attached to this project (client
                  contacts, prior commenters). Pick to scope to this stage
                  without retyping. Already-assigned guests render with a
                  green check and toggle off on click. */}
              {projectGuests.length > 0 && (
                <div className="max-h-40 overflow-y-auto -mx-1 px-1 mb-1">
                  {projectGuests.map((g) => {
                    const email = g.email.trim().toLowerCase();
                    const assigned = guests.some((sg) => sg.email.trim().toLowerCase() === email);
                    return (
                      <button
                        key={`pg-${email}`}
                        type="button"
                        onClick={() => assigned ? removeGuest(email) : addGuestByEmail(email, g.name)}
                        disabled={busy}
                        className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface disabled:opacity-50"
                      >
                        <Avatar
                          imageUrl={null}
                          name={g.name}
                          email={g.email}
                          seed={g.email}
                          size={24}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-caption text-gray-800 truncate">{g.name || g.email}</div>
                          {g.name && <div className="text-detail text-faint truncate">{g.email}</div>}
                        </div>
                        {assigned && <Check size={14} className="text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 border-t border-edge mt-1">
                <Mail size={13} className="text-faint shrink-0" />
                <input
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                  placeholder="Invite a new email..."
                  type="email"
                  className="flex-1 min-w-0 text-caption outline-none placeholder:text-gray-300 py-1.5"
                />
                <button
                  type="button"
                  onClick={addGuest}
                  disabled={busy || !guestEmail.trim()}
                  className="text-detail font-semibold text-teal hover:text-teal/80 disabled:text-gray-300"
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
