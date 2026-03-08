// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, TeamMember } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// Renamed from 'super_admin_company_override' — agencies also use this mechanism
const COMPANY_OVERRIDE_KEY = 'company_override';

type AccountType = 'agency' | 'client';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  // account_type of the user's own company (never changes with override)
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

  const fetchTeamMember = useCallback(async (userId: string) => {
    const { data: member } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!member) {
      setTeamMember(null);
      return;
    }

    setTeamMember(member);

    // Fetch own company's account_type
    const { data: ownCompany } = await supabase
      .from('companies')
      .select('account_type')
      .eq('id', member.company_id)
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
        const isSuperAdmin = member.is_super_admin;
        const isAgencyAdmin =
          ownType === 'agency' &&
          (member.role === 'owner' || member.role === 'admin');

        if (override.companyId !== member.company_id && (isSuperAdmin || isAgencyAdmin)) {
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
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchTeamMember(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchTeamMember(session.user.id);
      } else {
        setTeamMember(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchTeamMember]);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string, inviteToken?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };

    if (data.user) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: data.user.id,
          name,
          email,
          invite_token: inviteToken || undefined,
        }),
      });
      const result = await res.json();
      if (result.error) return { error: { message: result.error } };
      await fetchTeamMember(data.user.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    localStorage.removeItem(COMPANY_OVERRIDE_KEY);
    localStorage.removeItem('super_admin_company_override'); // clean up legacy key
    setCompanyOverrideState(null);
    setAccountType(ownAccountType);
    await supabase.auth.signOut();
    setSession(null);
    setTeamMember(null);
  };

  const updatePreferences = async (prefs: Partial<Pick<TeamMember,
    | 'notify_proposal_viewed' | 'notify_proposal_accepted'
    | 'notify_comment_added' | 'notify_comment_resolved'
    | 'notify_review_comment_added' | 'notify_review_item_status'
    | 'name' | 'avatar_path'
  >>) => {
    if (!teamMember) return;
    const { error } = await supabase
      .from('team_members')
      .update({ ...prefs, updated_at: new Date().toISOString() })
      .eq('id', teamMember.id);
    if (!error) {
      setTeamMember({ ...teamMember, ...prefs });
    }
    return { error };
  };

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

  const isSuperAdmin = teamMember?.is_super_admin ?? false;

  const isAgencyAdmin =
    ownAccountType === 'agency' &&
    (teamMember?.role === 'owner' || teamMember?.role === 'admin');

  // Effective company_id: super admin or agency admin override takes precedence
  const effectiveCompanyId =
    companyOverride && (isSuperAdmin || isAgencyAdmin)
      ? companyOverride.companyId
      : (teamMember?.company_id ?? null);

  return {
    session,
    teamMember,
    companyId: effectiveCompanyId,
    ownCompanyId: teamMember?.company_id ?? null,
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
    signUp,
    signOut,
    updatePreferences,
  };
}