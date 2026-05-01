'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Member = { id: string; user_id: string | null; name: string | null; email: string; role: string | null };
type Assignee = { team_member_id: string };

export default function ProjectAssigneesPanel({
  projectId,
  companyId,
  currentUserId,
}: {
  projectId: string;
  companyId: string;
  /** Auth user id — used to identify "self" in the list, even when the user
   *  has multiple team_members rows across companies. */
  currentUserId: string | null;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

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

  const assignedIds = new Set(assignees.map((a) => a.team_member_id));
  const assignedMembers = members.filter((m) => assignedIds.has(m.id));
  const unassignedMembers = members.filter((m) => !assignedIds.has(m.id));

  const ownTeamMember = currentUserId
    ? members.find((m) => m.user_id === currentUserId) ?? null
    : null;

  const add = async (memberId: string) => {
    setSaving(memberId);
    const res = await authedFetch(buildUrl(), {
      method: 'POST',
      body: JSON.stringify({ team_member_id: memberId }),
    });
    setSaving(null);
    setPickerOpen(false);
    if (res.ok) refresh();
  };

  const remove = async (memberId: string) => {
    setSaving(memberId);
    const res = await authedFetch(
      `/api/feedback-projects/${projectId}/assignees?team_member_id=${memberId}&company_id=${companyId}`,
      { method: 'DELETE' }
    );
    setSaving(null);
    if (res.ok) refresh();
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
          Assigned team members get an email for every comment, reply, resolve and status change on
          this project. To stop receiving notifications, remove yourself.
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
            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3"
              >
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
                  disabled={saving === m.id}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <X size={14} />
                  Remove
                </button>
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
                disabled={saving === m.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-ink truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                {saving === m.id && (
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
