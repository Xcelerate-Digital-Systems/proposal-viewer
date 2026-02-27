// hooks/useGuestIdentity.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GUEST_STORAGE_KEY } from '@/lib/review-defaults';

/**
 * Manages guest reviewer name with localStorage persistence.
 * Used by public review pages where viewers identify themselves by name.
 */
export function useGuestIdentity() {
  const [guestName, setGuestName] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const { name } = JSON.parse(stored);
        if (name) setGuestName(name);
      }
    } catch {}
  }, []);

  // Persist to localStorage
  const saveGuestIdentity = useCallback((name: string) => {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ name }));
    } catch {}
  }, []);

  return { guestName, setGuestName, saveGuestIdentity };
}