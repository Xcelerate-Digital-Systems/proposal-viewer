// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, TeamMember } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { resetAnalyticsUser } from '@/components/analytics/PostHogProvider';

const COMPANY_OVERRIDE_KEY = 'company_override';
const ACTIVE_MEMBERSHIP_KEY = 'active_membership_id';

// Module-level deduplication: Supabase's onAuthStateChange fires into every
// subscriber, so N components using useAuth() create N redundant listeners
// that each trigger full membership re-fetches. This flag ensures only the
// first mounted instance registers the listener; subsequent mounts skip it.
// The first instance's cleanup unsets the flag so a future mount can re-register.
let _authListenerActive = false;

type AccountType = 'agency' | 'client';

/**
 * useAuth (Stage 1 of the multi-membership refactor).
 *
 * A single auth.users identity can hold a team_members row in N companies
 * (the schema's unique constraint is on (user_id, company_id), not user_id
 * alone). This hook now embraces that: `memberships` is the full list of
 * rows for the signed-in user, `activeMembership` is the one currently in
 * effect, and the legacy `teamMember` / `companyId` fields are aliased to
 * the active membership so every existing caller keeps working unchanged.
 *
 * Cross-company access still flows through `companyOverride` for super
 * admins and agency owners "viewing as" a client company — but switching
 * between workspaces you are a *real* member of no longer goes through
 * override (it's just a different activeMembership).
 *
 * Picking the active membership on load:
 *   1. localStorage[active_membership_id] if it still resolves to a row,
 *   2. else the super-admin row (preserves the prior behaviour),
 *   3. else the oldest row by created_at.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<TeamMember[]>([]);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // account_type of the active membership's company (never changes with override)
  const [ownAccountType, setOwnAccountType] = useState<AccountType>('agency');
  // account_type of the currently active (possibly overridden) company
  const [accountType, setAccountType] = useState<AccountType>('agency');

  const [companyOverride, setCompanyOverrideState] = useState<{
    companyId: string;
    companyName: string;
  } | null>(null);

  // Load override from localStorage on mount
  // Also migrate old key name transparently
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(COMPANY_OVERRIDE_KEY) ||
        localStorage.getItem('super_admin_company_override');
      if (stored) {
        setCompanyOverrideState(JSON.parse(stored));
        // Ensure it's under the new key
        localStorage.setItem(COMPANY_OVERRIDE_KEY, stored);
        localStorage.removeItem('super_admin_company_override');
      }
    } catch {}
  }, []);

  /** Choose which row in `rows` should be the active membership. */
  const pickActiveMembership = useCallback((rows: TeamMember[]): TeamMember | null => {
    if (rows.length === 0) return null;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_MEMBERSHIP_KEY);
    } catch {}
    if (stored) {
      const hit = rows.find((r) => r.id === stored);
      if (hit) return hit;
    }
    // Super-admin row first (preserves prior pick), then oldest
    const sorted = [...rows].sort((a, b) => {
      if (a.is_super_admin !== b.is_super_admin) return a.is_super_admin ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return sorted[0];
  }, []);

  const fetchMemberships = useCallback(async (userId: string) => {
    let { data: rows } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // Self-heal: a logged-in user with no team_members row probably came in
    // via magic link and never went through /api/auth/register. If there's a
    // pending invite for their email, claim it now.
    if (!rows || rows.length === 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch('/api/auth/claim-invite', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const result = await res.json();
            if (result.claimed) {
              const refetch = await supabase
                .from('team_members')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });
              rows = refetch.data ?? [];
            }
          }
        }
      } catch {
        // Network issues here shouldn't block the rest of the auth flow.
      }
    }

    // Filter out memberships pointing at a soft-deleted company. Without
    // this a user with a deleted workspace as their active membership
    // would land on AuthGuard's "Workspace deleted" screen on every
    // sign-in and never reach their other workspaces.
    let all = rows ?? [];
    if (all.length > 0) {
      const companyIds = Array.from(new Set(all.map((r) => r.company_id)));
      const { data: companyRows } = await supabase
        .from('companies')
        .select('id, deleted_at')
        .in('id', companyIds);
      const deleted = new Set(
        (companyRows ?? [])
          .filter((c) => c.deleted_at !== null)
          .map((c) => c.id),
      );
      all = all.filter((r) => !deleted.has(r.company_id));
    }
    setMemberships(all);

    const active = pickActiveMembership(all);
    if (!active) {
      setActiveMembershipId(null);
      return;
    }
    setActiveMembershipId(active.id);

    // Persist the pick so a hard refresh lands on the same workspace.
    try {
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, active.id);
    } catch {}

    // Fetch active membership's company's account_type
    const { data: ownCompany } = await supabase
      .from('companies')
      .select('account_type')
      .eq('id', active.company_id)
      .single();

    const ownType = (ownCompany?.account_type as AccountType) ?? 'agency';
    setOwnAccountType(ownType);

    // Resolve override account_type if one is active
    try {
      const stored =
        localStorage.getItem(COMPANY_OVERRIDE_KEY) ||
        localStorage.getItem('super_admin_company_override');
      if (stored) {
        const override = JSON.parse(stored) as { companyId: string; companyName: string };
        const isSuperAdmin = active.is_super_admin;
        const isAgencyAdmin =
          ownType === 'agency' &&
          (active.role === 'owner' || active.role === 'admin');

        if (override.companyId !== active.company_id && (isSuperAdmin || isAgencyAdmin)) {
          const { data: overrideCompany } = await supabase
            .from('companies')
            .select('account_type')
            .eq('id', override.companyId)
            .single();
          setAccountType((overrideCompany?.account_type as AccountType) ?? 'agency');
          return;
        }
      }
    } catch {}

    setAccountType(ownType);
  }, [pickActiveMembership]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchMemberships(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Only the first mounted instance registers the auth state listener to
    // avoid N redundant listeners triggering N membership re-fetches.
    if (_authListenerActive) return;
    _authListenerActive = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchMemberships(session.user.id);
      } else {
        setMemberships([]);
        setActiveMembershipId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      _authListenerActive = false;
    };
  }, [fetchMemberships]);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Critical: prevents Supabase from auto-creating an auth.users row on
        // first OTP request. Account creation must go through the invite flow
        // so a team_members row is also created — otherwise the user ends up
        // orphaned and every API call 401s.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    opts?: { inviteToken?: string; companyName?: string },
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };

    if (data.user) {
      // The Supabase signUp call returns a session for email/password —
      // forward its access_token so the API can verify the user identity
      // server-side instead of trusting the body's user_id.
      const accessToken = data.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          invite_token: opts?.inviteToken || undefined,
          company_name: opts?.companyName || undefined,
        }),
      });
      const result = await res.json();
      if (result.error) return { error: { message: result.error } };
      await fetchMemberships(data.user.id);
    }

    return { error: null };
  };

  /**
   * Start a Supabase OAuth flow. Supabase redirects the browser to the
   * provider, the provider redirects back to /auth/callback?code=... where
   * the client SDK picks up the PKCE handshake. The callback page is then
   * responsible for calling /api/auth/register if the user has no
   * team_members row yet (self-serve signup).
   */
  const signInWithOAuth = async (provider: 'google') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  };

  const resetPasswordForEmail = async (email: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.error || 'Failed to send reset email' } };
      }
      return { error: null };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Network error' } };
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(COMPANY_OVERRIDE_KEY);
      localStorage.removeItem('super_admin_company_override');
      localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY);
    } catch {}
    setCompanyOverrideState(null);
    setAccountType(ownAccountType);
    setMemberships([]);
    setActiveMembershipId(null);
    await supabase.auth.signOut();
    setSession(null);
    resetAnalyticsUser();
  };

  // Derive the active membership object from the id (so React batches
  // re-renders correctly when memberships[] / activeMembershipId change).
  const activeMembership: TeamMember | null =
    memberships.find((m) => m.id === activeMembershipId) ?? null;

  const updatePreferences = async (prefs: Partial<Pick<TeamMember,
    | 'notify_proposal_viewed' | 'notify_proposal_accepted'
    | 'notify_comment_added' | 'notify_comment_resolved'
    | 'name' | 'avatar_path'
  >>) => {
    if (!activeMembership) return;
    const { error } = await supabase
      .from('team_members')
      .update({ ...prefs, updated_at: new Date().toISOString() })
      .eq('id', activeMembership.id);
    if (!error) {
      setMemberships((prev) =>
        prev.map((m) => (m.id === activeMembership.id ? { ...m, ...prefs } : m)),
      );
    }
    return { error };
  };

  /**
   * Switch to a different workspace the user is a real member of. Clears
   * any active "view as" override (they're meaningfully different actions —
   * being a member trumps borrowing). Persists locally so a refresh sticks
   * on the same workspace.
   */
  const setActiveMembership = useCallback(async (id: string) => {
    const target = memberships.find((m) => m.id === id);
    if (!target) return;
    try {
      localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, id);
      localStorage.removeItem(COMPANY_OVERRIDE_KEY);
    } catch {}
    setCompanyOverrideState(null);
    setActiveMembershipId(id);
    const { data: targetCompany } = await supabase
      .from('companies')
      .select('account_type')
      .eq('id', target.company_id)
      .single();
    const t = (targetCompany?.account_type as AccountType) ?? 'agency';
    setOwnAccountType(t);
    setAccountType(t);
  }, [memberships]);

  // Enter another company's account (super admin or agency admin)
  const setCompanyOverride = async (companyId: string, companyName: string) => {
    const override = { companyId, companyName };
    localStorage.setItem(COMPANY_OVERRIDE_KEY, JSON.stringify(override));
    setCompanyOverrideState(override);

    // Fetch and update accountType for the target company
    const { data: targetCompany } = await supabase
      .from('companies')
      .select('account_type')
      .eq('id', companyId)
      .single();
    setAccountType((targetCompany?.account_type as AccountType) ?? 'agency');
  };

  // Exit back to own account
  const clearCompanyOverride = () => {
    localStorage.removeItem(COMPANY_OVERRIDE_KEY);
    setCompanyOverrideState(null);
    setAccountType(ownAccountType);
  };

  const isSuperAdmin = activeMembership?.is_super_admin ?? false;

  const isAgencyAdmin =
    ownAccountType === 'agency' &&
    (activeMembership?.role === 'owner' || activeMembership?.role === 'admin');

  // Effective company_id: super admin or agency admin override takes precedence
  const effectiveCompanyId =
    companyOverride && (isSuperAdmin || isAgencyAdmin)
      ? companyOverride.companyId
      : (activeMembership?.company_id ?? null);

  return {
    session,
    // Legacy: `teamMember` is the active membership; every existing caller
    // already treats this as "the row I'm currently acting as".
    teamMember: activeMembership,
    // New API for multi-workspace UIs.
    memberships,
    activeMembership,
    setActiveMembership,
    companyId: effectiveCompanyId,
    ownCompanyId: activeMembership?.company_id ?? null,
    isSuperAdmin,
    isAgencyAdmin,
    accountType,        // account_type of the currently active company
    ownAccountType,     // account_type of the user's own company (unaffected by override)
    companyOverride,
    setCompanyOverride,
    clearCompanyOverride,
    loading,
    signInWithPassword,
    signInWithMagicLink,
    signInWithOAuth,
    signUp,
    signOut,
    updatePreferences,
    resetPasswordForEmail,
    updatePassword,
    refreshMemberships: fetchMemberships,
  };
}
