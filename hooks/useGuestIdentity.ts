'use client';

import { useState, useEffect, useCallback } from 'react';
import { GUEST_STORAGE_KEY } from '@/lib/review-defaults';

type StoredIdentity = { name?: string; email?: string };

/**
 * Manages guest reviewer identity (name + optional email) with localStorage
 * persistence. Same key is used by the embeddable widget, so visitors only
 * need to identify themselves once per device.
 */
export function useGuestIdentity() {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredIdentity;
        if (parsed.name) setGuestName(parsed.name);
        if (parsed.email) setGuestEmail(parsed.email);
      }
    } catch {}
    setHydrated(true);
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
