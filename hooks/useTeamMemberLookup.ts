// hooks/useTeamMemberLookup.ts
//
// Fetches a token-scoped lookup of company team members so the feedback UI
// can render real avatars + names next to comments authored by team users
// (vs the initial-bubble fallback used for guests). The endpoint is
// share-token scoped — works for both authenticated admin views and the
// anonymous public review viewer.

import { useEffect, useState } from 'react';

export type TeamMemberInfo = { name: string; avatarUrl: string | null };
export type TeamMemberLookup = Record<string, TeamMemberInfo>;

const cache = new Map<string, Promise<TeamMemberLookup>>();

function fetchLookup(token: string): Promise<TeamMemberLookup> {
  let p = cache.get(token);
  if (!p) {
    p = fetch(`/api/feedback/${encodeURIComponent(token)}/team-members`, {
      credentials: 'omit',
    })
      .then((r) => (r.ok ? r.json() : { members: {} }))
      .then((d) => (d?.members as TeamMemberLookup) || {})
      .catch(() => ({}));
    cache.set(token, p);
    // Signed URLs are valid for an hour — refresh the cache well before.
    setTimeout(() => cache.delete(token), 45 * 60 * 1000);
  }
  return p;
}

export function useTeamMemberLookup(token?: string | null): TeamMemberLookup {
  const [map, setMap] = useState<TeamMemberLookup>({});
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLookup(token).then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return map;
}
