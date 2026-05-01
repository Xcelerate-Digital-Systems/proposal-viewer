'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Check, ChevronDown, X, MessageSquare, CornerDownRight,
  CheckCheck, Layers, Package,
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

  const refresh = useCallback(async () => {
    const res = await authedFetch(buildUrl());
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMembers(data.members || []);
    setAssignees(data.assignees || []);
    setLoading(false);
  }, [authedFetch, buildUrl]);

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
    </div>
  );
}
