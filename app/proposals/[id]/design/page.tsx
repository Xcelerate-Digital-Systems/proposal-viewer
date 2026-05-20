// app/proposals/[id]/design/page.tsx
'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function ProposalDesignPage() {
  const { proposal, refetch, companyId, companyBgPrimary } = useProposalDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <DesignTab
        type="proposal"
        entityId={proposal.id}
        entityTitle={proposal.title}
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
        initialFontHeadingFamily={proposal.font_heading_family ?? null}
        initialFontHeadingWeight={proposal.font_heading_weight ?? null}
        initialFontBodyFamily={proposal.font_body_family ?? null}
        initialFontBodyWeight={proposal.font_body_weight ?? null}
        initialTitleFontTransform={(proposal as { title_font_transform?: string | null }).title_font_transform ?? null}
        initialFontHeadingTransform={(proposal as { font_heading_transform?: string | null }).font_heading_transform ?? null}
        initialFontBodyTransform={(proposal as { font_body_transform?: string | null }).font_body_transform ?? null}
        initialPageNumCircleColor={proposal.page_num_circle_color ?? null}
        initialPageNumTextColor={proposal.page_num_text_color ?? null}
        coverEntity={proposal}
      />
    </div>
  );
}
