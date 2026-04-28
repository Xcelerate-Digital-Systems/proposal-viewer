// components/admin/proposals/ProposalDetailContext.tsx
'use client';

import { createContext, useContext } from 'react';
import type { Proposal } from '@/lib/supabase';

export interface ProposalDetailContextValue {
  proposal: Proposal;
  refetch: () => Promise<void>;
  companyId: string;
  customDomain: string | null;
  companyBgPrimary: string;
}

const ProposalDetailContext = createContext<ProposalDetailContextValue | null>(null);

export const ProposalDetailProvider = ProposalDetailContext.Provider;

export function useProposalDetail(): ProposalDetailContextValue {
  const ctx = useContext(ProposalDetailContext);
  if (!ctx) {
    throw new Error('useProposalDetail must be used inside the proposal detail layout');
  }
  return ctx;
}
