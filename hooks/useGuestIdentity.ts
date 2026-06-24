'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GUEST_STORAGE_KEY } from '@/lib/review-defaults';

type StoredIdentity = { name?: string; email?: string };

/**
 * Manages guest reviewer identity (name + optional email) with localStorage
 * persistence. Same key is used by the embeddable widget, so visitors only
 * need to identify themselves once per device.
 *
 * If the visitor is already signed in (has a Supabase session), their team
 * member name + email are used automatically so the onboarding modal is
 * never shown.
 */
export function useGuestIdentity() {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // 1. Check for an active Supabase session — if signed in, use the
      //    team member's name + email so they skip the guest prompt entirely.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !cancelled) {
          const { data: member } = await supabase
            .from('team_members')
            .select('name, email')
            .eq('user_id', session.user.id)
            .limit(1)
            .single();
          if (member?.name && !cancelled) {
            setGuestName(member.name);
            setGuestEmail(member.email ?? '');
            try {
              localStorage.setItem(
                GUEST_STORAGE_KEY,
                JSON.stringify({ name: member.name, email: member.email ?? '' }),
              );
            } catch {}
            setHydrated(true);
            return;
          }
        }
      } catch {}

      // 2. Fall back to localStorage guest identity.
      try {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (stored && !cancelled) {
          const parsed = JSON.parse(stored) as StoredIdentity;
          if (parsed.name) setGuestName(parsed.name);
          if (parsed.email) setGuestEmail(parsed.email);
        }
      } catch {}
      if (!cancelled) setHydrated(true);
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  const saveGuestIdentity = useCallback((name: string, email = '') => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    setGuestName(trimmedName);
    setGuestEmail(trimmedEmail);
    try {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      );
    } catch {}
  }, []);

  return {
    guestName,
    guestEmail,
    setGuestName,
    setGuestEmail,
    saveGuestIdentity,
    /** True once localStorage has been read — use to defer rendering until identity is known. */
    hydrated,
  };
}
