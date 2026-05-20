// components/admin/quotes/QuoteBuilderV2.tsx
// Builder layout mirrors QuoteWin's section order:
//   1.  Proposal Style preset
//   2.  Activity (our addition — collapsed by default)
//   3.  Client Details
//   4.  Project Details (Title / Category / Valid Until)
//   5.  Scope of Works
//   6.  Project Photos
//   7.  Line Items
//   8.  Pricing (GST / Deposit)
//   9.  About Your Business
//   10. Customer Testimonial
//   11. Badges
//   12. Next Steps
//   13. Terms & Conditions
//   14. Attachments
// Deeper styling (backgrounds, fonts, custom colours) lives on the Settings
// tab; Cover lives on the Cover tab.
'use client';

import type { Proposal } from '@/lib/supabase';

import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';

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
import QuoteLineItemsSection from './sections/QuoteLineItemsSection';
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
          <QuoteActivityTimeline proposal={proposal} />

          <ClientDetailsSection proposal={proposal} companyId={companyId} onSaved={onRefetch} />

          <QuoteProjectDetailsSection proposal={proposal} onSaved={onRefetch} />

          <ScopeOfWorksSection proposal={proposal} onSaved={onRefetch} />

          <ProjectPhotosSection proposal={proposal} onSaved={onRefetch} />

          <QuoteLineItemsSection proposal={proposal} companyId={companyId} onApplied={onRefetch} />

          <PricingSettingsSection proposal={proposal} onSaved={onRefetch} />

          <AboutUsSection proposal={proposal} onSaved={onRefetch} />

          <TestimonialSection proposal={proposal} onSaved={onRefetch} />

          <BadgesSection proposal={proposal} onSaved={onRefetch} />

          <NextStepsSection proposal={proposal} onSaved={onRefetch} />

          <TermsSection proposal={proposal} onSaved={onRefetch} />

          <AttachmentsSection proposal={proposal} onSaved={onRefetch} />
        </div>

        {/* Right: sticky preview — PreviewPane handles its own sticky+max-h. */}
        <StickyPreviewAside sticky={false}>
          <PreviewPane proposal={proposal} companyId={companyId} />
        </StickyPreviewAside>
      </div>
    </div>
  );
}
