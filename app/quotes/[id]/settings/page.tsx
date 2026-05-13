// app/quotes/[id]/settings/page.tsx
// Settings tab — global styling for the quote. Everything that used to be
// scattered across "Proposal Style", "Backgrounds", and the legacy quote-design
// tab lives here, in one tab. The Builder tab keeps content fields only.
'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import ProposalStyleSection from '@/components/admin/proposals/quote-builder/sections/ProposalStyleSection';
import BackgroundsSection from '@/components/admin/proposals/quote-builder/sections/BackgroundsSection';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteSettingsPage() {
  const { proposal, refetch, companyId, companyBgPrimary } = useProposalDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-5 max-w-3xl">
      <ProposalStyleSection proposal={proposal} companyId={companyId} onSaved={refetch} />
      <BackgroundsSection proposal={proposal} onSaved={refetch} />
      <DesignTab
        type="proposal"
        entityId={proposal.id}
        companyId={companyId}
        initialBgImagePath={proposal.bg_image_path}
        initialBgImageOverlayOpacity={proposal.bg_image_overlay_opacity}
        companyBgPrimary={companyBgPrimary}
        onSave={refetch}
        initialPageOrientation={proposal.page_orientation || 'portrait'}
        initialTextPageBgColor={proposal.text_page_bg_color ?? null}
        initialTextPageTextColor={proposal.text_page_text_color ?? null}
        initialTextPageHeadingColor={proposal.text_page_heading_color ?? null}
        initialTextPageFontSize={proposal.text_page_font_size ?? null}
        initialTextPageBorderEnabled={proposal.text_page_border_enabled ?? null}
        initialTextPageBorderColor={proposal.text_page_border_color ?? null}
        initialTextPageBorderRadius={proposal.text_page_border_radius ?? null}
        initialTextPageLayout={proposal.text_page_layout ?? null}
        initialTitleFontFamily={proposal.title_font_family ?? null}
        initialTitleFontWeight={proposal.title_font_weight ?? null}
        initialTitleFontSize={proposal.title_font_size ?? null}
        initialPageNumCircleColor={proposal.page_num_circle_color ?? null}
        initialPageNumTextColor={proposal.page_num_text_color ?? null}
      />
    </div>
  );
}
