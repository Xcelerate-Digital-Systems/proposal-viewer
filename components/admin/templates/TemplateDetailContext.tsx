// components/admin/templates/TemplateDetailContext.tsx
'use client';

import { createContext, useContext } from 'react';
import type { ProposalTemplate } from '@/lib/supabase';

export interface TemplateDetailContextValue {
  template: ProposalTemplate;
  refetch: () => Promise<void>;
  companyId: string;
  companyBgPrimary: string;
}

const TemplateDetailContext = createContext<TemplateDetailContextValue | null>(null);

export const TemplateDetailProvider = TemplateDetailContext.Provider;

export function useTemplateDetail(): TemplateDetailContextValue {
  const ctx = useContext(TemplateDetailContext);
  if (!ctx) {
    throw new Error('useTemplateDetail must be used inside the template detail layout');
  }
  return ctx;
}
