// components/admin/proposals/PricingTab.tsx
'use client';

import type { ReactNode } from 'react';
import PricingSection from '@/components/admin/builder-sections/PricingSection';
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
    <PricingSection
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
