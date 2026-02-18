'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, TeamMember } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeamMember = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .single();
    setTeamMember(data);
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchTeamMember(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
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

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };

    // Create team_member row via API (uses service role to bypass RLS)
    if (data.user) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: data.user.id, name, email }),
      });
      const result = await res.json();
      if (result.error) return { error: { message: result.error } };
      await fetchTeamMember(data.user.id);
    }

    return { error: null };
  };

  const signOut = async () => {
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

  return {
    session,
    teamMember,
    loading,
    signInWithPassword,
    signInWithMagicLink,
    signUp,
    signOut,
    updatePreferences,
  };
}