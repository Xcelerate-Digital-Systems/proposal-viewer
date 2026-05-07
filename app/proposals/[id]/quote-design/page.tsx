// app/proposals/[id]/quote-design/page.tsx
// Quote-specific Design tab. Reuses the same DesignTab surface as proposals
// — fonts, colours, background image, title typography — so the controls
// feel familiar. Quote-only viewer reads these fields:
//   text_page_bg_color   → article body background
//   text_page_text_color → body text
//   text_page_heading_color → section headings & labels
//   title_font_family/weight/size → cover title + total figures
//   bg_image_path         → behind the cover header
// Text-page-specific fields (border, page numbering) are no-ops for quotes
// since quotes are single-page.

'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteDesignPage() {
  const { proposal, refetch, companyId, companyBgPrimary } = useProposalDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
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
