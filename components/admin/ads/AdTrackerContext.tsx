// components/admin/ads/AdTrackerContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAdTrackers } from '@/hooks/useAdTrackers';

type AdTrackerCtx = ReturnType<typeof useAdTrackers>;

const Ctx = createContext<AdTrackerCtx | null>(null);

export function AdTrackerProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const trackers = useAdTrackers(companyId);
  return <Ctx.Provider value={trackers}>{children}</Ctx.Provider>;
}

export function useAdTrackerContext(): AdTrackerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useAdTrackerContext must be used inside <AdTrackerProvider>');
  }
  return ctx;
}
