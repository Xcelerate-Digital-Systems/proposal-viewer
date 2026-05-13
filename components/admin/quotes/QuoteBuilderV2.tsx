// components/admin/quotes/QuoteBuilderV2.tsx
// New Quote builder layout. Content-only — global styling (Proposal Style preset,
// Backgrounds, fonts, colours) lives on the Settings tab; Cover lives on the
// Cover tab. The toggle clutter is gone: ProposalStyle/Backgrounds/Cover-link
// cards moved out, and stale per-section toggles like `show_job_fields`
// dropped.
'use client';

import { Layers } from 'lucide-react';
import type { Proposal } from '@/lib/supabase';

import PricingTab from '@/components/admin/proposals/PricingTab';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import LineItemsLibraryBar from '@/components/admin/proposals/quote-builder/LineItemsLibraryBar';
import LoadTemplateBar from '@/components/admin/proposals/quote-builder/LoadTemplateBar';
import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';

// Reused (unchanged) from the legacy quote-builder section folder.
import ClientDetailsSection from '@/components/admin/proposals/quote-builder/sections/ClientDetailsSection';
import ProjectPhotosSection from '@/components/admin/proposals/quote-builder/sections/ProjectPhotosSection';
import AboutUsSection from '@/components/admin/proposals/quote-builder/sections/AboutUsSection';
import TestimonialSection from '@/components/admin/proposals/quote-builder/sections/TestimonialSection';
import BadgesSection from '@/components/admin/proposals/quote-builder/sections/BadgesSection';
import NextStepsSection from '@/components/admin/proposals/quote-builder/sections/NextStepsSection';
import TermsSection from '@/components/admin/proposals/quote-builder/sections/TermsSection';

// New quote-specific sections.
import QuoteProjectDetailsSection from './sections/ProjectDetailsSection';
import ScopeOfWorksSection from './sections/ScopeOfWorksSection';
import PricingSettingsSection from './sections/PricingSettingsSection';
import AttachmentsSection from './sections/AttachmentsSection';
import QuoteActivityTimeline from './QuoteActivityTimeline';

interface Props {
  proposal: Proposal;
  companyId: string;
  onRefetch: () => void;
}

export default function QuoteBuilderV2({ proposal, companyId, onRefetch }: Props) {
  return (
    <div className="px-6 lg:px-10 py-6">
      <div className="flex gap-6">
        {/* Left: stacked sections */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-center justify-end">
            <LoadTemplateBar proposal={proposal} companyId={companyId} onApplied={onRefetch} />
          </div>

          <QuoteActivityTimeline proposal={proposal} />

          <ClientDetailsSection
            proposal={proposal}
            companyId={companyId}
            onSaved={onRefetch}
          />

          <QuoteProjectDetailsSection proposal={proposal} onSaved={onRefetch} />

          <ScopeOfWorksSection proposal={proposal} onSaved={onRefetch} />

          <ProjectPhotosSection proposal={proposal} onSaved={onRefetch} />

          <SectionCard
            title="Line Items"
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

          <PricingSettingsSection proposal={proposal} onSaved={onRefetch} />

          <AboutUsSection proposal={proposal} onSaved={onRefetch} />

          <TestimonialSection proposal={proposal} onSaved={onRefetch} />

          <BadgesSection proposal={proposal} onSaved={onRefetch} />

          <NextStepsSection proposal={proposal} onSaved={onRefetch} />

          <TermsSection proposal={proposal} onSaved={onRefetch} />

          <AttachmentsSection proposal={proposal} onSaved={onRefetch} />
        </div>

        {/* Right: sticky preview */}
        <aside className="hidden xl:block w-[420px] shrink-0">
          <PreviewPane proposal={proposal} companyId={companyId} />
        </aside>
      </div>
    </div>
  );
}
