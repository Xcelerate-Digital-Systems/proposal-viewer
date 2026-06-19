'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronDown, ChevronRight, X, MessageSquare, CornerDownRight,
  CheckCheck, Layers, Package, RotateCcw, UserPlus, Users, Bell, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REVIEW_STATUS_ORDER, getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackStatus } from '@/lib/types/feedback';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

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

const ALL_PREF_KEYS = PREF_DEFS.map((p) => p.key);

/* ── Avatar ────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarInitials(name: string, email: string): string {
  const source = (name || email || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, email, seed, size = 24 }: {
  name: string; email: string; seed: string; size?: number;
}) {
  return (
    <div
      className={`rounded-full text-2xs font-semibold text-white flex items-center justify-center shrink-0 ${avatarColor(seed)}`}
      style={{ width: size, height: size }}
    >
      {avatarInitials(name, email)}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */

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

  // Distill: collapsible rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Harden: save feedback
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  // Polish: show/hide removed guests
  const [showRemoved, setShowRemoved] = useState(false);

  const markSaved = useCallback((key: string) => {
    setSavedKeys((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1200);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    setExpandedIds((prev) => new Set(prev).add(memberId));
    refresh();
  };

  const remove = async (memberId: string) => {
    setSavingFor(memberId);
    await authedFetch(
      `/api/campaigns/${projectId}/assignees?team_member_id=${memberId}&company_id=${companyId}`,
      { method: 'DELETE' }
    );
    setSavingFor(null);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
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
    setExpandedIds((prev) => new Set(prev).add(email));
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
    if (res.ok) {
      markSaved(`gpref-${email}-${key}`);
    } else {
      refresh();
    }
  };

  const toggleAllGuestPrefs = async (email: string, allOn: boolean) => {
    const guest = guests.find((g) => g.email === email);
    if (!guest) return;
    const newPrefs: GuestPrefs = {
      notify_comment: allOn,
      notify_reply: allOn,
      notify_resolve: allOn,
      notify_status: allOn,
      notify_new_version: allOn,
    };
    setGuests((prev) =>
      prev.map((g) => (g.email === email ? { ...g, prefs: newPrefs } : g))
    );
    const res = await authedFetch(guestsUrl, {
      method: 'PATCH',
      body: JSON.stringify({ email, prefs: newPrefs }),
    });
    if (res.ok) {
      ALL_PREF_KEYS.forEach((k) => markSaved(`gpref-${email}-${k}`));
    } else {
      refresh();
    }
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
    if (res.ok) {
      markSaved(`stage-${memberId}-${stage}`);
    } else {
      refresh();
    }
  };

  const resetMemberStages = async (memberId: string) => {
    const current = assignedById.get(memberId);
    if (!current || current.stages.length === 0) return;
    const toRemove = [...current.stages];
    setAssignees((prev) =>
      prev.map((a) => (a.team_member_id === memberId ? { ...a, stages: [] } : a)),
    );
    const results = await Promise.all(
      toRemove.map((stage) =>
        authedFetch(
          `${stageRoute}?kind=member&stage=${stage}&team_member_id=${encodeURIComponent(memberId)}`,
          { method: 'DELETE' },
        )
      )
    );
    if (results.some((r) => !r.ok)) refresh();
    else toRemove.forEach((s) => markSaved(`stage-${memberId}-${s}`));
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
    if (res.ok) {
      markSaved(`gstage-${email}-${stage}`);
    } else {
      refresh();
    }
  };

  const resetGuestStages = async (email: string) => {
    const guest = guests.find((g) => g.email === email);
    if (!guest || guest.stages.length === 0) return;
    const toRemove = [...guest.stages];
    setGuests((prev) =>
      prev.map((g) => (g.email === email ? { ...g, stages: [] } : g)),
    );
    const results = await Promise.all(
      toRemove.map((stage) =>
        authedFetch(
          `${stageRoute}?kind=guest&stage=${stage}&email=${encodeURIComponent(email)}`,
          { method: 'DELETE' },
        )
      )
    );
    if (results.some((r) => !r.ok)) refresh();
    else toRemove.forEach((s) => markSaved(`gstage-${email}-${s}`));
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
    if (res.ok) {
      markSaved(`pref-${memberId}-${key}`);
    } else {
      refresh();
    }
  };

  const toggleAllPrefs = async (memberId: string, allOn: boolean) => {
    const current = assignedById.get(memberId);
    if (!current) return;
    const newPrefs = Object.fromEntries(ALL_PREF_KEYS.map((k) => [k, allOn]));
    setAssignees((prev) =>
      prev.map((a) => (a.team_member_id === memberId ? { ...a, ...newPrefs } : a))
    );
    const res = await authedFetch(buildUrl(), {
      method: 'PATCH',
      body: JSON.stringify({ team_member_id: memberId, prefs: newPrefs }),
    });
    if (res.ok) {
      ALL_PREF_KEYS.forEach((k) => markSaved(`pref-${memberId}-${k}`));
    } else {
      refresh();
    }
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
          Click a row to configure notifications and stages.
        </p>

        <div className="border border-edge rounded-2xl bg-white divide-y divide-edge">
          {assignedMembers.length === 0 ? (
            <div className="px-4 py-6 text-caption text-faint text-center">
              No one is assigned yet. Add a team member below.
            </div>
          ) : (
            assignedMembers.map((m) => {
              const isSelf = ownTeamMember?.id === m.id;
              const a = assignedById.get(m.id)!;
              const isExpanded = expandedIds.has(m.id);
              const prefCount = ALL_PREF_KEYS.filter((k) => a[k]).length;
              const stageCount = a.stages.length;

              return (
                <div key={m.id} className="group">
                  {/* Collapsed header — always visible */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(m.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface/50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <Avatar name={m.name || ''} email={m.email} seed={m.id} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium text-ink truncate">
                        {m.name || m.email}
                        {isSelf && <span className="ml-2 text-xs text-faint">(you)</span>}
                      </p>
                      <p className="text-xs text-faint truncate">{m.email}</p>
                    </div>

                    {/* Summary badges (collapsed) */}
                    {!isExpanded && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
                          <Bell size={9} />
                          {prefCount}/{ALL_PREF_KEYS.length}
                        </span>
                        {stageCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
                            <Layers size={9} />
                            {stageCount}
                          </span>
                        )}
                      </div>
                    )}

                    <ChevronRight
                      size={14}
                      className={`text-faint shrink-0 transition-transform duration-150 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      {/* Notification prefs */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-detail font-medium text-dim">Notifications</span>
                        <span className="text-detail text-faint">·</span>
                        <button
                          type="button"
                          onClick={() => toggleAllPrefs(m.id, true)}
                          className="text-detail text-teal hover:text-teal/80 transition-colors"
                        >
                          All on
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAllPrefs(m.id, false)}
                          className="text-detail text-faint hover:text-prose transition-colors"
                        >
                          All off
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {PREF_DEFS.map((p) => {
                          const Icon = p.icon;
                          const on = a[p.key];
                          const justSaved = savedKeys.has(`pref-${m.id}-${p.key}`);
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => togglePref(m.id, p.key)}
                              aria-pressed={on}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                                on
                                  ? 'bg-teal/10 text-teal'
                                  : 'bg-surface text-faint hover:text-prose'
                              }`}
                              title={`${on ? 'On' : 'Off'} — ${p.label}`}
                            >
                              {justSaved ? <Check size={11} className="text-emerald-500" /> : <Icon size={11} />}
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <StagesChipRow
                        selected={a.stages}
                        onToggle={(stage) => toggleMemberStage(m.id, stage)}
                        onReset={() => resetMemberStages(m.id)}
                        savedKeys={savedKeys}
                        savedPrefix={`stage-${m.id}`}
                      />

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          disabled={savingFor === m.id}
                          className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <X size={14} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
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
                setPickerPos({
                  top: r.bottom + 4,
                  left: Math.min(r.left, window.innerWidth - 272),
                });
              }
              setPickerOpen((v) => !v);
            }}
            disabled={unassignedMembers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-edge-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add team member
            <ChevronDown size={14} />
          </button>

          {pickerOpen && unassignedMembers.length > 0 && pickerPos && createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div
                className="fixed z-50 w-64 bg-white border border-edge rounded-2xl shadow-lg py-1 max-h-72 overflow-y-auto"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                {unassignedMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => add(m.id)}
                    disabled={savingFor === m.id}
                    className="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-2.5"
                  >
                    <Avatar name={m.name || ''} email={m.email} seed={m.id} />
                    <div className="min-w-0 flex-1">
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

        <div className="border border-edge rounded-2xl bg-white divide-y divide-edge">
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
                  isExpanded={expandedIds.has(g.email)}
                  onToggleExpand={() => toggleExpanded(g.email)}
                  onTogglePref={toggleGuestPref}
                  onToggleAllPrefs={toggleAllGuestPrefs}
                  onToggleStage={toggleGuestStage}
                  onResetStages={resetGuestStages}
                  onSetRemoved={setGuestRemoved}
                  onResendInvite={resendInvite}
                  resending={resending === g.email}
                  savedKeys={savedKeys}
                />
              ))}

              {/* Show removed toggle */}
              {removedGuests.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRemoved((v) => !v)}
                    className="w-full px-4 py-2 text-detail text-faint hover:text-prose transition-colors text-center"
                  >
                    {showRemoved ? 'Hide' : 'Show'} {removedGuests.length} removed guest{removedGuests.length !== 1 ? 's' : ''}
                  </button>
                  {showRemoved &&
                    removedGuests.map((g) => (
                      <GuestRow
                        key={g.email}
                        guest={g}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                        onTogglePref={toggleGuestPref}
                        onToggleAllPrefs={toggleAllGuestPrefs}
                        onToggleStage={toggleGuestStage}
                        onResetStages={resetGuestStages}
                        onSetRemoved={setGuestRemoved}
                        onResendInvite={resendInvite}
                        resending={resending === g.email}
                        savedKeys={savedKeys}
                      />
                    ))}
                </>
              )}
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
                  <ContactAutocomplete
                    value={guestEmail}
                    onChange={setGuestEmail}
                    onSelect={(c) => {
                      setGuestEmail(c.email);
                      if (c.name && !guestName) setGuestName(c.name);
                    }}
                    placeholder="guest@example.com"
                    autoFocus
                    className="w-full px-3 py-1.5 text-caption border border-edge-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
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
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium border border-edge-strong rounded-full hover:border-edge-hover transition-colors"
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
  isExpanded,
  onToggleExpand,
  onTogglePref,
  onToggleAllPrefs,
  onToggleStage,
  onResetStages,
  onSetRemoved,
  onResendInvite,
  resending,
  savedKeys,
}: {
  guest: Guest;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePref: (email: string, key: PrefKey) => void;
  onToggleAllPrefs: (email: string, allOn: boolean) => void;
  onToggleStage: (email: string, stage: FeedbackStatus) => void;
  onResetStages: (email: string) => void;
  onSetRemoved: (email: string, removed: boolean) => void;
  onResendInvite: (email: string, name: string) => void;
  resending: boolean;
  savedKeys: Set<string>;
}) {
  if (g.removed) {
    return (
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 opacity-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={g.name || ''} email={g.email} seed={g.email} size={24} />
          <div className="min-w-0">
            <p className="text-caption text-ink truncate">{g.name || g.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSetRemoved(g.email, false)}
          className="text-xs text-faint hover:text-teal transition-colors flex items-center gap-1 shrink-0"
        >
          <RotateCcw size={14} />
          Restore
        </button>
      </div>
    );
  }

  const prefCount = ALL_PREF_KEYS.filter((k) => g.prefs[k]).length;
  const stageCount = g.stages.length;

  return (
    <div>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <Avatar name={g.name || ''} email={g.email} seed={g.email} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-ink truncate">{g.name || g.email}</p>
          <p className="text-xs text-faint truncate">{g.email}</p>
        </div>

        {!isExpanded && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
              <Bell size={9} />
              {prefCount}/{ALL_PREF_KEYS.length}
            </span>
            {stageCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-surface text-dim">
                <Layers size={9} />
                {stageCount}
              </span>
            )}
          </div>
        )}

        <ChevronRight
          size={14}
          className={`text-faint shrink-0 transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {/* Notification prefs */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-detail font-medium text-dim">Notifications</span>
            <span className="text-detail text-faint">·</span>
            <button
              type="button"
              onClick={() => onToggleAllPrefs(g.email, true)}
              className="text-detail text-teal hover:text-teal/80 transition-colors"
            >
              All on
            </button>
            <button
              type="button"
              onClick={() => onToggleAllPrefs(g.email, false)}
              className="text-detail text-faint hover:text-prose transition-colors"
            >
              All off
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PREF_DEFS.map((p) => {
              const Icon = p.icon;
              const on = g.prefs[p.key];
              const justSaved = savedKeys.has(`gpref-${g.email}-${p.key}`);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onTogglePref(g.email, p.key)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-detail font-medium transition-colors ${
                    on
                      ? 'bg-teal/10 text-teal'
                      : 'bg-surface text-faint hover:text-prose'
                  }`}
                  title={`${on ? 'On' : 'Off'} — ${p.label}`}
                >
                  {justSaved ? <Check size={11} className="text-emerald-500" /> : <Icon size={11} />}
                  {p.label}
                </button>
              );
            })}
          </div>

          <StagesChipRow
            selected={g.stages}
            onToggle={(stage) => onToggleStage(g.email, stage)}
            onReset={() => onResetStages(g.email)}
            audience="guest"
            savedKeys={savedKeys}
            savedPrefix={`gstage-${g.email}`}
          />

          <div className="mt-3 flex items-center justify-between">
            {!g.removed && (
              <button
                type="button"
                onClick={() => onResendInvite(g.email, g.name)}
                disabled={resending}
                className="text-xs text-faint hover:text-teal transition-colors flex items-center gap-1 disabled:opacity-50"
                title="Resend invite email"
              >
                {resending ? (
                  <div className="w-3 h-3 border-2 border-edge-hover border-t-teal rounded-full animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                Resend invite
              </button>
            )}
            <button
              type="button"
              onClick={() => onSetRemoved(g.email, true)}
              className="text-xs text-faint hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
            >
              <X size={14} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stages chip row ────────────────────────────────────────────────────── */

function StagesChipRow({
  selected, onToggle, onReset, audience = 'member', savedKeys, savedPrefix,
}: {
  selected: string[];
  onToggle: (stage: FeedbackStatus) => void;
  onReset: () => void;
  audience?: 'member' | 'guest';
  savedKeys: Set<string>;
  savedPrefix: string;
}) {
  const allStages = REVIEW_STATUS_ORDER;
  const visibleStages = audience === 'guest'
    ? allStages.filter((s) => s === 'client_review' || s === 'approved' || s === 'rejected')
    : allStages;
  const allDefault = selected.length === 0;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-edge">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Layers size={11} className="text-faint" />
        <span className="text-detail font-medium text-dim">Stages</span>
        {!allDefault && (
          <>
            <span className="text-detail text-faint">·</span>
            <button
              type="button"
              onClick={onReset}
              className="text-detail text-teal hover:text-teal/80 transition-colors"
            >
              Reset to all
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {/* "All" chip */}
        <button
          type="button"
          onClick={onReset}
          aria-pressed={allDefault}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
            allDefault
              ? 'bg-teal/10 text-teal border-teal/20'
              : 'bg-white text-faint border-edge-strong hover:text-prose hover:border-edge-hover'
          }`}
        >
          All
        </button>
        {visibleStages.map((s) => {
          const def = getFeedbackStatusDef(s);
          const on = selected.includes(s);
          const justSaved = savedKeys.has(`${savedPrefix}-${s}`);
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
                on
                  ? `${def.bg} ${def.text} ${def.border}`
                  : 'bg-white text-faint border-edge-strong hover:text-prose hover:border-edge-hover'
              }`}
              title={on ? `Scoped to ${def.label}` : `Click to scope to ${def.label}`}
            >
              {justSaved ? (
                <Check size={9} className="text-emerald-500" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${on ? def.dot : 'bg-faint'}`} />
              )}
              {def.label}
            </button>
          );
        })}
      </div>
      {audience === 'guest' && (
        <p className="text-2xs text-faint mt-1.5">
          Guests can only be assigned to client-facing stages.
        </p>
      )}
    </div>
  );
}
