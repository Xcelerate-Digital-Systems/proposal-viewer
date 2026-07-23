// hooks/useVariantDecisions.ts
//
// Client-side hook for per-variant approve/reject decisions on Meta ad
// copy variants. Fetches decisions for an item's variants and exposes
// mutations (set / clear).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '@/lib/auth-fetch';

export type VariantDecision = 'approved' | 'changes_requested';

export type VariantDecisionRow = {
  id: string;
  item_id: string;
  variant_id: string;
  reviewer_kind: 'member' | 'guest';
  reviewer_team_member_id: string | null;
  reviewer_email: string | null;
  reviewer_name: string | null;
  decision: VariantDecision;
  stage: string;
  created_at: string;
};

export type VariantDecisionSummary = {
  approved: number;
  changes_requested: number;
  total: number;
};

interface UseVariantDecisionsOptions {
  itemId: string | null;
  /** Pass variant IDs to scope — empty array skips fetch. */
  variantIds: string[];
  /** Share token for guest access (public viewer). */
  shareToken?: string;
  /** Guest identity for unauthenticated reviewers. */
  guestEmail?: string;
  guestName?: string;
}

export function useVariantDecisions({
  itemId,
  variantIds,
  shareToken,
  guestEmail,
  guestName,
}: UseVariantDecisionsOptions) {
  const [decisions, setDecisions] = useState<VariantDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch decisions for all variants of this item.
  const fetchDecisions = useCallback(async () => {
    if (!itemId || variantIds.length === 0) {
      setDecisions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ item_id: itemId });
      if (shareToken) params.set('share_token', shareToken);
      const res = await authFetch(`/api/feedback/variant-decisions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.decisions ?? []);
      }
    } catch {
      // Non-critical — decisions just won't show.
    } finally {
      setLoading(false);
    }
  }, [itemId, variantIds.length, shareToken]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  // Set or toggle a decision for a specific variant.
  const setDecision = useCallback(async (
    variantId: string,
    decision: VariantDecision,
    stage: string,
  ) => {
    if (!itemId) return;

    // Optimistic: check if this decision already exists for this reviewer.
    // If clicking the same decision, clear it instead.
    const existing = decisions.find((d) => d.variant_id === variantId);
    if (existing?.decision === decision) {
      // Clear — toggle off.
      return clearDecision(variantId);
    }

    try {
      const body: Record<string, unknown> = {
        item_id: itemId,
        variant_id: variantId,
        decision,
        stage,
      };
      if (shareToken) body.share_token = shareToken;
      if (guestEmail) body.guest_email = guestEmail;
      if (guestName) body.guest_name = guestName;

      const res = await authFetch('/api/feedback/variant-decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchDecisions();
      }
    } catch {
      // Silently fail — non-critical.
    }
  }, [itemId, decisions, shareToken, guestEmail, guestName, fetchDecisions]);

  // Clear a decision for a variant.
  const clearDecision = useCallback(async (variantId: string) => {
    if (!itemId) return;
    try {
      const body: Record<string, unknown> = {
        item_id: itemId,
        variant_id: variantId,
      };
      if (shareToken) body.share_token = shareToken;
      if (guestEmail) body.guest_email = guestEmail;

      const res = await authFetch('/api/feedback/variant-decisions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchDecisions();
      }
    } catch {
      // Silently fail.
    }
  }, [itemId, shareToken, guestEmail, fetchDecisions]);

  // Summaries per variant — { approved, changes_requested, total }.
  const summaries = useMemo(() => {
    const map: Record<string, VariantDecisionSummary> = {};
    for (const vid of variantIds) {
      const forVariant = decisions.filter((d) => d.variant_id === vid);
      // Deduplicate by reviewer (keep latest).
      const byReviewer = new Map<string, VariantDecisionRow>();
      for (const d of forVariant) {
        const key = d.reviewer_team_member_id || d.reviewer_email || d.id;
        const existing = byReviewer.get(key);
        if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
          byReviewer.set(key, d);
        }
      }
      const unique = Array.from(byReviewer.values());
      map[vid] = {
        approved: unique.filter((d) => d.decision === 'approved').length,
        changes_requested: unique.filter((d) => d.decision === 'changes_requested').length,
        total: unique.length,
      };
    }
    return map;
  }, [decisions, variantIds]);

  // Current reviewer's decision per variant (for showing active state on pills).
  const myDecisions = useMemo(() => {
    const map: Record<string, VariantDecision | null> = {};
    for (const vid of variantIds) {
      // We can't know the current reviewer's ID on the client, so return
      // the most recent decision for the variant. The API deduplicates by
      // reviewer anyway — this only has one row per variant per reviewer.
      // For now, just return the latest for the current viewer.
      const forVariant = decisions
        .filter((d) => d.variant_id === vid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      // If we have guest email, filter by it.
      if (guestEmail) {
        const mine = forVariant.find((d) => d.reviewer_email === guestEmail);
        map[vid] = mine?.decision ?? null;
      } else {
        // Authenticated — decisions from the first row for this variant
        // are probably the current user's (the API filters by reviewer).
        map[vid] = forVariant[0]?.decision ?? null;
      }
    }
    return map;
  }, [decisions, variantIds, guestEmail]);

  return {
    decisions,
    summaries,
    myDecisions,
    setDecision,
    clearDecision,
    loading,
    refetch: fetchDecisions,
  };
}
