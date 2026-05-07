// components/admin/proposals/PricingTab.tsx
'use client';

import type { ReactNode } from 'react';
import PricingTabEditor from '@/components/admin/shared/PricingTabEditor';
import type { PricingLineItem } from '@/lib/types/packages';

interface PricingTabProps {
  proposalId: string;
  lineItemsToolbar?: (api: {
    items: PricingLineItem[];
    replaceItems: (items: PricingLineItem[]) => void;
  }) => ReactNode;
  hidePreview?: boolean;
}

export default function PricingTab({ proposalId, lineItemsToolbar, hidePreview }: PricingTabProps) {
  return (
    <PricingTabEditor
      apiBase="/api/proposals/pages"
      entityKey="proposal_id"
      entityId={proposalId}
      companyId={null}
      proposalId={proposalId}
      lineItemsToolbar={lineItemsToolbar}
      hidePreview={hidePreview}
    />
  );
}
