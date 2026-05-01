'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Check, ChevronDown, X, MessageSquare, CornerDownRight,
  CheckCheck, Layers, Package, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Member = { id: string; user_id: string | null; name: string | null; email: string; role: string | null };

type Assignee = {
  team_member_id: string;
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
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

  const buildUrl = useCallback(
    (suffix = '') =>
      `/api/feedback-projects/${projectId}/assignees${suffix}?company_id=${companyId}`,
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

  const guestsUrl = `/api/feedback-projects/${projectId}/guests?company_id=${companyId}`;

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
      `/api/feedback-projects/${projectId}/assignees?team_member_id=${memberId}&company_id=${companyId}`,
      { method: 'DELETE' }
    );
    setSavingFor(null);
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

  const togglePref = async (memberId: string, key: PrefKey) => {
    const current = assignedById.get(memberId);
    if (!current) return;
    const next = !current[key];
    // Optimistic update.
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
        <div className="w-5 h-5 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink mb-1">Notifications</h3>
        <p className="text-[13px] text-gray-500">
          Assigned team members get email alerts for activity on this project. Each person can toggle
          which event types they want individually.
        </p>
      </div>

      <div className="border border-gray-100 rounded-xl bg-white divide-y divide-gray-100">
        {assignedMembers.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-gray-400 text-center">
            No one is assigned. Notifications won&apos;t be sent until someone is added.
          </div>
        ) : (
          assignedMembers.map((m) => {
            const isSelf = ownTeamMember?.id === m.id;
            const a = assignedById.get(m.id)!;
            return (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {m.name || m.email}
                      {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={savingFor === m.id}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
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
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          on
                            ? 'bg-teal/10 text-teal'
                            : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                        }`}
                        title={`${on ? 'On' : 'Off'} — ${p.label}`}
                      >
                        <Icon size={11} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={unassignedMembers.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-gray-200 rounded-full hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add team member
          <ChevronDown size={14} />
        </button>

        {pickerOpen && unassignedMembers.length > 0 && (
          <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-100 rounded-xl shadow-lg py-1 max-h-72 overflow-y-auto">
            {unassignedMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => add(m.id)}
                disabled={savingFor === m.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-ink truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                {savingFor === m.id && (
                  <Check size={14} className="text-teal shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Guests — auto-listed once they comment with an email or are the
          project's primary client_email. */}
      <div className="pt-4 border-t border-gray-100">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-ink mb-1">Guests</h3>
          <p className="text-[13px] text-gray-500">
            Clients and outside reviewers who&apos;ve commented on this project. Toggle which event
            types they get emails about, or remove them entirely.
          </p>
        </div>

        <div className="border border-gray-100 rounded-xl bg-white divide-y divide-gray-100">
          {guests.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-gray-400 text-center">
              No guests yet. They&apos;ll appear here once they leave a comment with their email.
            </div>
          ) : (
            guests.map((g) => (
              <div key={g.email} className={`px-4 py-3 ${g.removed ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {g.name || g.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{g.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestRemoved(g.email, !g.removed)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 shrink-0"
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

                {!g.removed && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PREF_DEFS.map((p) => {
                      const Icon = p.icon;
                      const on = g.prefs[p.key];
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => toggleGuestPref(g.email, p.key)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            on
                              ? 'bg-teal/10 text-teal'
                              : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                          }`}
                          title={`${on ? 'On' : 'Off'} — ${p.label}`}
                        >
                          <Icon size={11} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
