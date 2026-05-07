// components/admin/proposals/quote-builder/QuoteBuilder.tsx
// QuoteWin-style single-page builder. Stacks the quote body sections in one
// scroll column. Cover (Design tab) and Table of Contents stay on their own
// pages — those settings aren't part of the day-to-day "fill out the quote"
// flow that this builder optimises for.

'use client';

import { Layers } from 'lucide-react';
import type { Proposal } from '@/lib/supabase';
import PricingTab from '@/components/admin/proposals/PricingTab';
import ProposalStyleSection from './sections/ProposalStyleSection';
import ClientDetailsSection from './sections/ClientDetailsSection';
import ProjectDetailsSection from './sections/ProjectDetailsSection';
import SectionCard from './SectionCard';
import LineItemsLibraryBar from './LineItemsLibraryBar';

interface QuoteBuilderProps {
  proposal: Proposal;
  companyId: string;
  onRefetch: () => void;
}

export default function QuoteBuilder({ proposal, companyId, onRefetch }: QuoteBuilderProps) {
  return (
    <div className="px-6 lg:px-10 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <ProposalStyleSection
          proposal={proposal}
          companyId={companyId}
          onSaved={onRefetch}
        />

        <ClientDetailsSection
          proposal={proposal}
          companyId={companyId}
          onSaved={onRefetch}
        />

        <ProjectDetailsSection
          proposal={proposal}
          onSaved={onRefetch}
        />

        <SectionCard
          title="Line Items & Pricing"
          icon={<Layers size={14} className="text-gray-400" />}
          description="Each row appears in the quote table. Save reusable sets to your library."
        >
          <PricingTab
            proposalId={proposal.id}
            lineItemsToolbar={({ items, replaceItems }) => (
              <LineItemsLibraryBar items={items} replaceItems={replaceItems} />
            )}
          />
        </SectionCard>
      </div>
    </div>
  );
}
