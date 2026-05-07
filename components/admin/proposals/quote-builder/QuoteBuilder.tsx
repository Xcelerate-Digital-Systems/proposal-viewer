// components/admin/proposals/quote-builder/QuoteBuilder.tsx
// QuoteWin-style single-page builder. Stacks every quote-body section in one
// scroll column on the left, with a sticky live preview pane on the right
// that reuses the same component the public viewer renders for clients.
// Cover styling lives on the dedicated Cover tab — that's a less frequent
// edit, but every text/data field that ends up on the rendered quote lives
// here so the builder is the single source of truth.

'use client';

import Link from 'next/link';
import { Layers, Paintbrush } from 'lucide-react';
import type { Proposal } from '@/lib/supabase';
import PricingTab from '@/components/admin/proposals/PricingTab';
import ProposalStyleSection from './sections/ProposalStyleSection';
import ClientDetailsSection from './sections/ClientDetailsSection';
import ProjectDetailsSection from './sections/ProjectDetailsSection';
import AboutUsSection from './sections/AboutUsSection';
import TestimonialSection from './sections/TestimonialSection';
import BadgesSection from './sections/BadgesSection';
import NextStepsSection from './sections/NextStepsSection';
import TermsSection from './sections/TermsSection';
import ProjectPhotosSection from './sections/ProjectPhotosSection';
import BackgroundsSection from './sections/BackgroundsSection';
import SectionCard from './SectionCard';
import LineItemsLibraryBar from './LineItemsLibraryBar';
import LoadTemplateBar from './LoadTemplateBar';
import PreviewPane from './PreviewPane';

interface QuoteBuilderProps {
  proposal: Proposal;
  companyId: string;
  onRefetch: () => void;
}

export default function QuoteBuilder({ proposal, companyId, onRefetch }: QuoteBuilderProps) {
  return (
    <div className="px-6 lg:px-10 py-6">
      {/* No items-start here — the aside needs to stretch the full column
          height so position:sticky on the preview can pin while scrolling. */}
      <div className="flex gap-6">
        {/* Left: stacked sections */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-center justify-end">
            <LoadTemplateBar
              proposal={proposal}
              companyId={companyId}
              onApplied={onRefetch}
            />
          </div>

          <ProposalStyleSection
            proposal={proposal}
            companyId={companyId}
            onSaved={onRefetch}
          />

          <BackgroundsSection proposal={proposal} onSaved={onRefetch} />

          {/* Pointer to fine-grained cover controls (image upload, fonts,
              prepared-by avatar) which still live on the dedicated tab. */}
          <Link
            href={`/proposals/${proposal.id}/quote-cover`}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Paintbrush size={14} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Cover image &amp; advanced styling</div>
                <div className="text-xs text-gray-400">
                  Upload a cover photo, adjust fonts, and tweak gradient on the Cover tab.
                </div>
              </div>
            </div>
            <span className="text-xs text-teal opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              Open Cover →
            </span>
          </Link>

          <ClientDetailsSection
            proposal={proposal}
            companyId={companyId}
            onSaved={onRefetch}
          />

          <ProjectDetailsSection proposal={proposal} onSaved={onRefetch} />

          <ProjectPhotosSection proposal={proposal} onSaved={onRefetch} />

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

          <BadgesSection proposal={proposal} onSaved={onRefetch} />
          <AboutUsSection proposal={proposal} onSaved={onRefetch} />
          <TestimonialSection proposal={proposal} onSaved={onRefetch} />
          <NextStepsSection proposal={proposal} onSaved={onRefetch} />
          <TermsSection proposal={proposal} onSaved={onRefetch} />
        </div>

        {/* Right: sticky live preview. Wider at 2xl so the cover + breakdown
            table don't get squashed. Hidden under xl — at that point the
            builder takes the full width and you preview via the header. */}
        <aside className="hidden xl:block w-[540px] 2xl:w-[640px] shrink-0">
          <PreviewPane proposal={proposal} companyId={companyId} />
        </aside>
      </div>
    </div>
  );
}
