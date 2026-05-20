// app/documents/[id]/design/page.tsx
'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import DocumentCoverEditor from '@/components/admin/documents/DocumentCoverEditor';
import { useDocumentDetail } from '@/components/admin/documents/DocumentDetailContext';

export default function DocumentDesignPage() {
  const { document, refetch, companyId, companyBgPrimary } = useDocumentDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <DesignTab
        type="document"
        entityId={document.id}
        entityTitle={document.title}
        companyId={companyId}
        initialBgImagePath={document.bg_image_path}
        initialBgImageOverlayOpacity={document.bg_image_overlay_opacity}
        companyBgPrimary={companyBgPrimary}
        onSave={refetch}
        initialPageOrientation={document.page_orientation || 'portrait'}
        initialTextPageBgColor={document.text_page_bg_color ?? null}
        initialTextPageTextColor={document.text_page_text_color ?? null}
        initialTextPageHeadingColor={document.text_page_heading_color ?? null}
        initialTextPageFontSize={document.text_page_font_size ?? null}
        initialTextPageBorderEnabled={document.text_page_border_enabled ?? null}
        initialTextPageBorderColor={document.text_page_border_color ?? null}
        initialTextPageBorderRadius={document.text_page_border_radius ?? null}
        initialTextPageLayout={document.text_page_layout ?? null}
        initialTitleFontFamily={document.title_font_family ?? null}
        initialTitleFontWeight={document.title_font_weight ?? null}
        initialTitleFontSize={document.title_font_size ?? null}
        initialFontHeadingFamily={document.font_heading_family ?? null}
        initialFontHeadingWeight={document.font_heading_weight ?? null}
        initialFontHeadingSize={(document as { font_heading_size?: string | null }).font_heading_size ?? null}
        initialFontBodyFamily={document.font_body_family ?? null}
        initialFontBodyWeight={document.font_body_weight ?? null}
        initialTitleFontTransform={(document as { title_font_transform?: string | null }).title_font_transform ?? null}
        initialFontHeadingTransform={(document as { font_heading_transform?: string | null }).font_heading_transform ?? null}
        initialFontBodyTransform={(document as { font_body_transform?: string | null }).font_body_transform ?? null}
        initialPageNumCircleColor={document.page_num_circle_color ?? null}
        initialPageNumTextColor={document.page_num_text_color ?? null}
      />
      <DocumentCoverEditor document={document} onSave={refetch} />
    </div>
  );
}
