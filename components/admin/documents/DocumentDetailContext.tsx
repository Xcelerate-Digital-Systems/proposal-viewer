// components/admin/documents/DocumentDetailContext.tsx
'use client';

import { createContext, useContext } from 'react';
import type { Document as DocType } from '@/lib/supabase';

export interface DocumentDetailContextValue {
  document: DocType;
  refetch: () => Promise<void>;
  companyId: string;
  customDomain: string | null;
  companyBgPrimary: string;
}

const DocumentDetailContext = createContext<DocumentDetailContextValue | null>(null);

export const DocumentDetailProvider = DocumentDetailContext.Provider;

export function useDocumentDetail(): DocumentDetailContextValue {
  const ctx = useContext(DocumentDetailContext);
  if (!ctx) {
    throw new Error('useDocumentDetail must be used inside the document detail layout');
  }
  return ctx;
}
