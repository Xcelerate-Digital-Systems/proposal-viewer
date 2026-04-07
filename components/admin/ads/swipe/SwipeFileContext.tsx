// components/admin/ads/swipe/SwipeFileContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSwipeFiles } from '@/hooks/useSwipeFiles';

type SwipeCtx = ReturnType<typeof useSwipeFiles>;

const Ctx = createContext<SwipeCtx | null>(null);

export function SwipeFileProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const swipe = useSwipeFiles(companyId);
  return <Ctx.Provider value={swipe}>{children}</Ctx.Provider>;
}

export function useSwipeFileContext(): SwipeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSwipeFileContext must be used inside <SwipeFileProvider>');
  }
  return ctx;
}
