'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronDown, X, MessageSquare, CornerDownRight,
  CheckCheck, Layers, Package, RotateCcw, UserPlus, Users, Bell, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REVIEW_STATUS_ORDER, getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackStatus } from '@/lib/types/feedback';

type Member = { id: string; user_id: string | null; name: string | null; email: string; role: string | null };

type Assignee = {
  team_member_id: string;
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
  stages: string[];
};

type GuestPrefs = {
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
};

type Guest = {
  email: string;
  name: string;
  removed: boolean;
  prefs: GuestPrefs;
  stages: string[];
};

type PrefKey =
  | 'notify_comment'
  | 'notify_reply'
  | 'notify_resolve'
  | 'notify_status'
  | 'notify_new_version';

const PREF_DEFS: { key: PrefKey; label: string; icon: typeof MessageSquare }[] = [
  { key: 'notify_comment', label: 'Comments', icon: MessageSquare },
  { key: 'notify_reply', label: 'Replies', icon: CornerDownRight },
  { key: 'notify_resolve', label: 'Resolved', icon: CheckCheck },
  { key: 'notify_status', label: 'Status changes', icon: Layers },
  { key: 'notify_new_version', label: 'New versions', icon: Package },
];

export default function ProjectAssigneesPanel({
  projectId,
  companyId,
  currentUserId,
}: {
  projectId: string;
  companyId: string;
  currentUserId: string | null;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const [guestFormOpen, setGuestFormOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestSendInvite, setGuestSendInvite] = useState(true);
  const [guestSaving, setGuestSaving] = useState(false);
  const guestEmailRef = useRef<HTMLInputElement>(null);

  const buildUrl = useCallback(
    (suffix = '') =>
      `/api/campaigns/${projectId}/assignees${suffix}?company_id=${companyId}`,
    [projectId, companyId]
  );

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, []);

  const guestsUrl = `/api/campaigns/${projectId}/guests?company_id=${companyId}`;

  const refresh = useCallback(async () => {
    const [a, g] = await Promise.all([
      authedFetch(buildUrl()),
      authedFetch(guestsUrl),
    ]);
    if (a.ok) {
      const data = await a.json();
      setMembers(data.members || []);
      setAssignees(data.assignees || []);
    }
    if (g.ok) {
      const data = await g.json();
      setGuests(data.guests || []);
    }
    setLoading(false);
  }, [authedFetch, buildUrl, guestsUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const assignedById = new Map(assignees.map((a) => [a.team_member_id, a]));
  const assignedMembers = members.filter((m) => assignedById.has(m.id));
  const unassignedMembers = members.filter((m) => !assignedById.has(m.id));

  const ownTeamMember = currentUserId
    ? members.find((m) => m.user_id === currentUserId) ?? null
    : null;

  const add = async (memberId: string) => {
    setSavingFor(memberId);
    await authedFetch(buildUrl(), {
      method: 'POST',
      body: JSON.stringify({ team_member_id: memberId }),
    });
    setSavingFor(null);
    setPickerOpen(false);
    refresh();
  };

  const remove = async (memberId: string) => {
    setSavingFor(memberId);
    await authedFetch(
      `/api/campaigns/${projectId}/assignees?team_member_id=${memberId}&company_id=${companyId}`,
      { method: 'DELETE' }
    );
    setSavingFor(null);
    refresh();
  };

  const addGuest = async () => {
    const email = guestEmail.trim().toLowerCase();
    if (!email) return;
    setGuestSaving(true);
    await authedFetch(guestsUrl, {
      method: 'POST',
      body: JSON.stringify({ email, name: guestName.trim(), sendInvite: guestSendInvite }),
    });
    setGuestSaving(false);
    setGuestEmail('');
    setGuestName('');
    setGuestSendInvite(true);
    setGuestFormOpen(false);
    refresh();
  };

  const toggleGuestPref = async (email: string, key: PrefKey) => {
    const guest = guests.find((g) => g.email === email);
    if (!guest) return;
    const next = !guest.prefs[key];
    setGuests((prev) =>
      prev.map((g) =>
        g.email === email ? { ...g, prefs: { ...g.prefs, [key]: next } } : g
      )
    );
    const res = await authedFetch(guestsUrl, {
      method: 'PATCH',
      body: JSON.stringify({ email, prefs: { [key]: next } }),
    });
    if (!res.ok) refresh();
  };

  const [resending, setResending] = useState<string | null>(null);
  const resendInvite = async (email: string, name: string) => {
    setResending(email);
    await authedFetch(guestsUrl, {
      method: 'POST',
      body: JSON.stringify({ email, name, sendInvite: true }),
    });
    setResending(null);
  };

  const setGuestRemoved = async (email: string, removed: boolean) => {
    setGuests((prev) =>
      prev.map((g) => (g.email === email ? { ...g, removed } : g))
    );
    const res = await authedFetch(guestsUrl, {
      method: 'PATCH',
      body: JSON.stringify({ email, removed }),
    });
    if (!res.ok) refresh();
  };

  const stageRoute = `/api/campaigns/${projectId}/stage-assignees`;

  const toggleMemberStage = async (memberId: string, stage: FeedbackStatus) => {
    const current = assignedById.get(memberId);
    if (!current) return;
    const isOn = current.stages.includes(stage);
    const nextStages = isOn
      ? current.stages.filter((s) => s !== stage)
      : [...current.stages, stage];
    setAssignees((prev) =>
      prev.map((a) => (a.team_member_id === memberId ? { ...a, stages: nextStages } : a)),
    );
    const url = isOn
      ? `${stageRoute}?kind=member&stage=${stage}&team_member_id=${encodeURIComponent(memberId)}`
      : stageRoute;
    const res = await authedFetch(url, {
      method: isOn ? 'DELETE' : 'POST',
      body: isOn
        ? undefined
        : JSON.stringify({ kind: 'member', stage, team_member_id: memberId }),
    });
    if (!res.ok) refresh();
  };

  const toggleGuestStage = async (email: string, stage: FeedbackStatus) => {
    const guest = guests.find((g) => g.email === email);
    if (!guest) return;
    const isOn = guest.stages.includes(stage);
    const nextStages = isOn
      ? guest.stages.filter((s) => s !== stage)
      : [...guest.stages, stage];
    setGuests((prev) =>
      prev.map((g) => (g.email === email ? { ...g, stages: nextStages } : g)),
    );
    const url = isOn
      ? `${stageRoute}?kind=guest&stage=${stage}&email=${encodeURIComponent(email)}`
      : stageRoute;
    const res = await authedFetch(url, {
      method: isOn ? 'DELETE' : 'POST',
      body: isOn
        ? undefined
        : JSON.stringify({ kind: 'guest', stage, email, name: guest.name }),
    });
    if (!res.ok) refresh();
  };

  const togglePref = async (memberId: string, key: PrefKey) => {
    const current = assignedById.get(memberId);
    if (!current) return;
    const next = !current[key];
    setAssignees((prev) =>
      prev.map((a) => (a.team_member_id === memberId ? { ...a, [key]: next } : a))
    );
    const res = await authedFetch(buildUrl(), {
      method: 'PATCH',
      body: JSON.stringify({ team_member_id: memberId, prefs: { [key]: next } }),
    });
    if (!res.ok) refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  const activeGuests = guests.filter((g) => !g.removed);
  const removedGuests = guests.filter((g) => g.removed);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* ── Team Members column ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Users size={15} className="text-faint" />
          <h3 className="text-sm font-semibold text-ink">Team Members</h3>
        </div>
        <p className="text-caption text-dim mb-4">
          Assigned team members receive email alerts for activity on this project.
          Toggle which events each person is notified about.
        </p>

        <div className="border border-edge rounded-2xl bg-white divide-y divide-gray-100">
          {assignedMembers.length === 0 ? (
            <div className="px-4 py-6 text-caption text-faint text-center">
              No one is assigned yet. Add a team member below.
            </div>
          ) : (
            assignedMembers.map((m) => {
              const isSelf = ownTeamMember?.id === m.id;
              const a = assignedById.get(m.id)!;
              return (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-caption font-medium text-ink truncate">
                        {m.name || m.email}
                        {isSelf && <span className="ml-2 text-xs text-faint">(you)</span>}
                      </p>
                      <p className="text-xs text-faint truncate">{m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      disabled={savingFor === m.id}
                      className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
                    >
                      <X size={14} />
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PREF_DEFS.map((p) => {
                      const Icon = p.icon;
                      const on = a[p.key];
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePref(m.id, p.key)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                            on
                              ? 'bg-teal/10 text-teal'
                              : 'bg-surface text-faint hover:text-prose'
                          }`}
                          title={`${on ? 'On' : 'Off'} — ${p.label}`}
                        >
                          <Icon size={11} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  <StagesChipRow
                    selected={a.stages}
                    onToggle={(stage) => toggleMemberStage(m.id, stage)}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="relative mt-3">
          <button
            ref={pickerBtnRef}
            type="button"
            onClick={() => {
              if (!pickerOpen && pickerBtnRef.current) {
                const r = pickerBtnRef.current.getBoundingClientRect();
                setPickerPos({ top: r.bottom + 4, left: r.left });
              }
              setPickerOpen((v) => !v);
            }}
            disabled={unassignedMembers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add team member
            <ChevronDown size={14} />
          </button>

          {pickerOpen && unassignedMembers.length > 0 && pickerPos && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setPickerOpen(false)} />
              <div
                className="fixed z-[9999] w-64 bg-white border border-edge rounded-2xl shadow-lg py-1 max-h-72 overflow-y-auto"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                {unassignedMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => add(m.id)}
                    disabled={savingFor === m.id}
                    className="w-full text-left px-3 py-2 hover:bg-surface flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-caption text-ink truncate">{m.name || m.email}</p>
                      <p className="text-xs text-faint truncate">{m.email}</p>
                    </div>
                    {savingFor === m.id && (
                      <Check size={14} className="text-teal shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
        </div>
      </section>

      {/* ── Guests column ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Bell size={15} className="text-faint" />
          <h3 className="text-sm font-semibold text-ink">Guests</h3>
        </div>
        <p className="text-caption text-dim mb-4">
          Clients and outside reviewers. They appear automatically when they comment,
          or you can add them manually below.
        </p>

        <div className="border border-edge rounded-2xl bg-white divide-y divide-gray-100">
          {activeGuests.length === 0 && removedGuests.length === 0 ? (
            <div className="px-4 py-6 text-caption text-faint text-center">
              No guests yet. Add one manually or they&apos;ll appear when they leave a comment.
            </div>
          ) : (
            <>
              {activeGuests.map((g) => (
                <GuestRow
                  key={g.email}
                  guest={g}
                  onTogglePref={toggleGuestPref}
                  onToggleStage={toggleGuestStage}
                  onSetRemoved={setGuestRemoved}
                  onResendInvite={resendInvite}
                  resending={resending === g.email}
                />
              ))}
              {removedGuests.map((g) => (
                <GuestRow
                  key={g.email}
                  guest={g}
                  onTogglePref={toggleGuestPref}
                  onToggleStage={toggleGuestStage}
                  onSetRemoved={setGuestRemoved}
                  onResendInvite={resendInvite}
                  resending={resending === g.email}
                />
              ))}
            </>
          )}
        </div>

        <div className="mt-3">
          {guestFormOpen ? (
            <div className="border border-edge-strong rounded-2xl bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-detail font-medium text-dim mb-1">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={guestEmailRef}
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addGuest();
                    }}
                  />
                </div>
                <div>
                  <label className="block text-detail font-medium text-dim mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addGuest();
                    }}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={guestSendInvite}
                  onChange={(e) => setGuestSendInvite(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-edge-strong text-teal focus:ring-teal/30 accent-teal"
                />
                <span className="text-detail text-dim">Send invite email with review link</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addGuest}
                  disabled={guestSaving || !guestEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50"
                >
                  {guestSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                  Add Guest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuestFormOpen(false);
                    setGuestEmail('');
                    setGuestName('');
                    setGuestSendInvite(true);
                  }}
                  className="px-3 py-1.5 text-caption font-medium text-dim hover:text-prose transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setGuestFormOpen(true);
                setTimeout(() => guestEmailRef.current?.focus(), 50);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-gray-300 transition-colors"
            >
              <UserPlus size={14} />
              Add guest
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Guest row ──────────────────────────────────────────────────────────── */

function GuestRow({
  guest: g,
  onTogglePref,
  onToggleStage,
  onSetRemoved,
  onResendInvite,
  resending,
}: {
  guest: Guest;
  onTogglePref: (email: string, key: PrefKey) => void;
  onToggleStage: (email: string, stage: FeedbackStatus) => void;
  onSetRemoved: (email: string, removed: boolean) => void;
  onResendInvite: (email: string, name: string) => void;
  resending: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${g.removed ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-medium text-ink truncate">
            {g.name || g.email}
          </p>
          <p className="text-xs text-faint truncate">{g.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!g.removed && (
            <button
              type="button"
              onClick={() => onResendInvite(g.email, g.name)}
              disabled={resending}
              className="text-xs text-faint hover:text-teal transition-colors flex items-center gap-1 disabled:opacity-50"
              title="Resend invite email"
            >
              {resending ? (
                <div className="w-3 h-3 border-2 border-gray-300 border-t-teal rounded-full animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Resend
            </button>
          )}
          <button
            type="button"
            onClick={() => onSetRemoved(g.email, !g.removed)}
            className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1"
          >
            {g.removed ? (
              <>
                <RotateCcw size={14} />
                Restore
              </>
            ) : (
              <>
                <X size={14} />
                Remove
              </>
            )}
          </button>
        </div>
      </div>

      {!g.removed && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PREF_DEFS.map((p) => {
              const Icon = p.icon;
              const on = g.prefs[p.key];
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onTogglePref(g.email, p.key)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                    on
                      ? 'bg-teal/10 text-teal'
                      : 'bg-surface text-faint hover:text-prose'
                  }`}
                  title={`${on ? 'On' : 'Off'} — ${p.label}`}
                >
                  <Icon size={11} />
                  {p.label}
                </button>
              );
            })}
          </div>
          <StagesChipRow
            selected={g.stages}
            onToggle={(stage) => onToggleStage(g.email, stage)}
            audience="guest"
          />
        </>
      )}
    </div>
  );
}

/* ── Stages chip row ────────────────────────────────────────────────────── */

function StagesChipRow({
  selected, onToggle, audience = 'member',
}: {
  selected: string[];
  onToggle: (stage: FeedbackStatus) => void;
  audience?: 'member' | 'guest';
}) {
  const allStages = REVIEW_STATUS_ORDER;
  const visibleStages = audience === 'guest'
    ? allStages.filter((s) => s === 'client_review' || s === 'approved' || s === 'rejected')
    : allStages;
  const allSelected = selected.length === 0;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-edge">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Layers size={11} className="text-faint" />
        <span className="text-detail font-medium text-dim">
          Stages {allSelected ? '— all (default)' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {visibleStages.map((s) => {
          const def = getFeedbackStatusDef(s);
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
                on
                  ? `${def.bg} ${def.text} ${def.border}`
                  : 'bg-white text-faint border-edge-strong hover:text-prose hover:border-gray-300'
              }`}
              title={on ? `Notifies on ${def.label}` : `Click to scope to ${def.label}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${def.dot}`} />
              {def.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
