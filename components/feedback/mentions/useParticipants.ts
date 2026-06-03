'use client';

import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/lib/feedback/participants';

const cache = new Map<string, Participant[]>();

function needsAuth(url: string): boolean {
  return url.startsWith('/api/campaigns/');
}

async function fetchParticipants(url: string): Promise<Response> {
  if (needsAuth(url)) {
    const { authFetch } = await import('@/lib/auth-fetch');
    return authFetch(url);
  }
  return fetch(url);
}

/**
 * Fetch the mentionable participants for the current comment surface once,
 * cache by URL across editor mounts (one cache entry per project / share
 * token). Returns a stable ref so the TipTap suggestion `items` callback can
 * read the latest list without re-mounting the extension.
 */
export function useParticipants(url: string | null) {
  const [participants, setParticipants] = useState<Participant[]>(() => (url ? cache.get(url) ?? [] : []));
  const ref = useRef<Participant[]>(participants);
  ref.current = participants;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    if (cache.has(url)) {
      const cached = cache.get(url)!;
      setParticipants(cached);
      ref.current = cached;
      return;
    }

    fetchParticipants(url)
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        const list: Participant[] = Array.isArray(body?.participants) ? body.participants : [];
        if (cancelled) return;
        cache.set(url, list);
        setParticipants(list);
        ref.current = list;
      })
      .catch(() => {
        // Mentions are an enhancement; if the fetch fails the editor still
        // works without autocomplete.
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { participants, participantsRef: ref };
}
