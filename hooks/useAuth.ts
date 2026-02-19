// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, TeamMember } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

const COMPANY_OVERRIDE_KEY = 'super_admin_company_override';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyOverride, setCompanyOverrideState] = useState<{
    companyId: string;
    companyName: string;
  } | null>(null);

  // Load override from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COMPANY_OVERRIDE_KEY);
      if (stored) {
        setCompanyOverrideState(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const fetchTeamMember = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .single();
    setTeamMember(data);
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
    setCompanyOverrideState(null);
    await supabase.auth.signOut();
    setSession(null);
    setTeamMember(null);
  };

  const updatePreferences = async (prefs: Partial<Pick<TeamMember,
    'notify_proposal_viewed' | 'notify_proposal_accepted' | 'notify_comment_added' | 'notify_comment_resolved' | 'name'
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

  // Super admin: enter another company's account
  const setCompanyOverride = (companyId: string, companyName: string) => {
    const override = { companyId, companyName };
    localStorage.setItem(COMPANY_OVERRIDE_KEY, JSON.stringify(override));
    setCompanyOverrideState(override);
  };

  // Super admin: exit back to own account
  const clearCompanyOverride = () => {
    localStorage.removeItem(COMPANY_OVERRIDE_KEY);
    setCompanyOverrideState(null);
  };

  const isSuperAdmin = teamMember?.is_super_admin ?? false;

  // If super admin has an override active, use that company_id — otherwise use their own
  const effectiveCompanyId = (isSuperAdmin && companyOverride)
    ? companyOverride.companyId
    : (teamMember?.company_id ?? null);

  return {
    session,
    teamMember,
    companyId: effectiveCompanyId,
    ownCompanyId: teamMember?.company_id ?? null,
    isSuperAdmin,
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