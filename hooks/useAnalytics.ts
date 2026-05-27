// hooks/useAnalytics.ts
//
// No-op-safe analytics tracker for client components. Drop in anywhere
// without checking whether PostHog is configured — `track()` silently
// returns if NEXT_PUBLIC_POSTHOG_KEY isn't set.

'use client';

import { useCallback } from 'react';
import posthog from 'posthog-js';
import { isAnalyticsEnabled } from '@/components/analytics/PostHogProvider';

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

export function useAnalytics() {
  const track = useCallback((event: string, props?: TrackProps) => {
    if (!isAnalyticsEnabled()) return;
    try {
      posthog.capture(event, props as Record<string, unknown>);
    } catch {
      /* fail silently — analytics must never break user flow */
    }
  }, []);

  return { track };
}
