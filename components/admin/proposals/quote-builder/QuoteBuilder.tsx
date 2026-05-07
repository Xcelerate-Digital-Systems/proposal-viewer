// components/admin/proposals/quote-builder/QuoteBuilder.tsx
// QuoteWin-style single-page builder. Stacks every quote-body section in one
// scroll column on the left, with a sticky live preview pane on the right
// that reuses the same component the public viewer renders for clients.
// Cover styling lives on its own Design tab — that's a less frequent edit.

'use client';

import { Layers } from 'lucide-react';
import type { Proposal } from '@/lib/supabase';
import PricingTab from '@/components/admin/proposals/PricingTab';
import ProposalStyleSection from './sections/ProposalStyleSection';
import ClientDetailsSection from './sections/ClientDetailsSection';
import ProjectDetailsSection from './sections/ProjectDetailsSection';
import AboutUsSection from './sections/AboutUsSection';
import TestimonialSection from './sections/TestimonialSection';
import TermsSection from './sections/TermsSection';
import SectionCard from './SectionCard';
import LineItemsLibraryBar from './LineItemsLibraryBar';
import PreviewPane from './PreviewPane';

interface QuoteBuilderProps {
  proposal: Proposal;
  companyId: string;
  onRefetch: () => void;
}

export default function QuoteBuilder({ proposal, companyId, onRefetch }: QuoteBuilderProps) {
  return (
    <div className="px-6 lg:px-10 py-6">
      <div className="flex gap-6 items-start">
        {/* Left: stacked sections */}
        <div className="flex-1 min-w-0 space-y-5">
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

          <ProjectDetailsSection proposal={proposal} onSaved={onRefetch} />

          <SectionCard
            title="Line Items & Pricing"
            icon={<Layers size={14} className="text-gray-400" />}
            description="Each row appears in the quote breakdown. Save reusable sets to your library."
          >
            <PricingTab
              proposalId={proposal.id}
              hidePreview
              lineItemsToolbar={({ items, replaceItems }) => (
                <LineItemsLibraryBar items={items} replaceItems={replaceItems} />
              )}
            />
          </SectionCard>

          <AboutUsSection proposal={proposal} onSaved={onRefetch} />
          <TestimonialSection proposal={proposal} onSaved={onRefetch} />
          <TermsSection proposal={proposal} onSaved={onRefetch} />
        </div>

        {/* Right: sticky live preview */}
        <aside className="hidden xl:block w-[420px] shrink-0">
          <PreviewPane proposal={proposal} companyId={companyId} />
        </aside>
      </div>
    </div>
  );
}
