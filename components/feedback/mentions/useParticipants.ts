'use client';

import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/lib/feedback/participants';

const cache = new Map<string, Participant[]>();
const inflight = new Map<string, Promise<Participant[]>>();

function needsAuth(url: string): boolean {
  return url.startsWith('/api/campaigns/');
}

async function doFetch(url: string): Promise<Participant[]> {
  const res = needsAuth(url)
    ? await (await import('@/lib/auth-fetch')).authFetch(url)
    : await fetch(url);
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body?.participants) ? body.participants : [];
}

function fetchOnce(url: string): Promise<Participant[]> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  let pending = inflight.get(url);
  if (!pending) {
    pending = doFetch(url).then((list) => {
      cache.set(url, list);
      inflight.delete(url);
      return list;
    }).catch(() => {
      inflight.delete(url);
      return [] as Participant[];
    });
    inflight.set(url, pending);
  }
  return pending;
}

/**
 * Fetch the mentionable participants for the current comment surface once,
 * cache by URL across editor mounts (one cache entry per project / share
 * token). Returns a stable ref AND a ready promise so the TipTap suggestion
 * `items` callback can await participants on first trigger.
 */
export function useParticipants(url: string | null) {
  const [participants, setParticipants] = useState<Participant[]>(
    () => (url ? cache.get(url) ?? [] : [])
  );
  const ref = useRef<Participant[]>(participants);
  ref.current = participants;

  const readyRef = useRef<Promise<Participant[]>>(
    url ? fetchOnce(url) : Promise.resolve([])
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const promise = fetchOnce(url);
    readyRef.current = promise;

    promise.then((list) => {
      if (cancelled) return;
      setParticipants(list);
      ref.current = list;
    });

    return () => { cancelled = true; };
  }, [url]);

  return { participants, participantsRef: ref, readyRef };
}
