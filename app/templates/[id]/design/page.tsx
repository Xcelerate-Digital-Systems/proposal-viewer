// app/templates/[id]/design/page.tsx
'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import TemplateCoverEditor from '@/components/admin/templates/TemplateCoverEditor';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateDesignPage() {
  const { template, refetch, companyId, companyBgPrimary } = useTemplateDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <DesignTab
        type="template"
        entityId={template.id}
        companyId={companyId}
        initialBgImagePath={template.bg_image_path}
        initialBgImageOverlayOpacity={template.bg_image_overlay_opacity}
        companyBgPrimary={companyBgPrimary}
        onSave={refetch}
        initialPageOrientation={template.page_orientation || 'portrait'}
        initialTextPageBgColor={template.text_page_bg_color ?? null}
        initialTextPageTextColor={template.text_page_text_color ?? null}
        initialTextPageHeadingColor={template.text_page_heading_color ?? null}
        initialTextPageFontSize={template.text_page_font_size ?? null}
        initialTextPageBorderEnabled={template.text_page_border_enabled ?? null}
        initialTextPageBorderColor={template.text_page_border_color ?? null}
        initialTextPageBorderRadius={template.text_page_border_radius ?? null}
        initialTextPageLayout={template.text_page_layout ?? null}
        initialTitleFontFamily={template.title_font_family ?? null}
        initialTitleFontWeight={template.title_font_weight ?? null}
        initialTitleFontSize={template.title_font_size ?? null}
        initialPageNumCircleColor={template.page_num_circle_color ?? null}
        initialPageNumTextColor={template.page_num_text_color ?? null}
      />
      <TemplateCoverEditor template={template} onSave={refetch} />
    </div>
  );
}
