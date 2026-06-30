'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';
import type { Member, Assignee, Guest, GuestPrefs, PrefKey } from './assignee-types';
import { ALL_PREF_KEYS } from './assignee-types';

export default function useProjectAssignees(
  projectId: string,
  companyId: string,
  currentUserId: string | null,
) {
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

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showRemoved, setShowRemoved] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

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

  /* ── Derived values ─────────────────────────────────────────────────── */

  const assignedById = new Map(assignees.map((a) => [a.team_member_id, a]));
  const assignedMembers = members.filter((m) => assignedById.has(m.id));
  const unassignedMembers = members.filter((m) => !assignedById.has(m.id));
  const ownTeamMember = currentUserId
    ? members.find((m) => m.user_id === currentUserId) ?? null
    : null;
  const activeGuests = guests.filter((g) => !g.removed);
  const removedGuests = guests.filter((g) => g.removed);

  /* ── Team member callbacks ──────────────────────────────────────────── */

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

  /* ── Guest callbacks ────────────────────────────────────────────────── */

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

  /* ── Picker position helper ─────────────────────────────────────────── */

  const openPicker = useCallback(() => {
    if (!pickerOpen && pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect();
      setPickerPos({
        top: r.bottom + 4,
        left: Math.min(r.left, window.innerWidth - 272),
      });
    }
    setPickerOpen((v) => !v);
  }, [pickerOpen]);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  return {
    // State
    loading,
    pickerOpen,
    savingFor,
    pickerBtnRef,
    pickerPos,
    guestFormOpen,
    guestEmail,
    guestName,
    guestSendInvite,
    guestSaving,
    expandedIds,
    savedKeys,
    showRemoved,
    resending,

    // Setters
    setGuestFormOpen,
    setGuestEmail,
    setGuestName,
    setGuestSendInvite,
    setShowRemoved,

    // Derived
    assignedById,
    assignedMembers,
    unassignedMembers,
    ownTeamMember,
    activeGuests,
    removedGuests,

    // Callbacks
    add,
    remove,
    addGuest,
    togglePref,
    toggleAllPrefs,
    toggleMemberStage,
    resetMemberStages,
    toggleGuestPref,
    toggleAllGuestPrefs,
    resendInvite,
    setGuestRemoved,
    toggleGuestStage,
    resetGuestStages,
    toggleExpanded,
    openPicker,
    closePicker,
  };
}
