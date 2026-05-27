// app/templates/[id]/design/page.tsx
'use client';

import DesignTab from '@/components/admin/shared/DesignTab';
import { useTemplateDetail } from '@/components/admin/templates/TemplateDetailContext';

export default function TemplateDesignPage() {
  const { template, refetch, companyId, companyBgPrimary } = useTemplateDetail();

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-6">
      <DesignTab
        type="template"
        entityId={template.id}
        entityTitle={template.name}
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
        initialFontHeadingFamily={template.font_heading_family ?? null}
        initialFontHeadingWeight={template.font_heading_weight ?? null}
        initialFontHeadingSize={(template as { font_heading_size?: string | null }).font_heading_size ?? null}
        initialFontBodyFamily={template.font_body_family ?? null}
        initialFontBodyWeight={template.font_body_weight ?? null}
        initialFontButtonFamily={template.font_button_family ?? null}
        initialFontButtonWeight={template.font_button_weight ?? null}
        initialTitleFontTransform={(template as { title_font_transform?: string | null }).title_font_transform ?? null}
        initialFontHeadingTransform={(template as { font_heading_transform?: string | null }).font_heading_transform ?? null}
        initialFontBodyTransform={(template as { font_body_transform?: string | null }).font_body_transform ?? null}
        initialPageNumCircleColor={template.page_num_circle_color ?? null}
        initialPageNumTextColor={template.page_num_text_color ?? null}
        initialPricingHeaderTextColor={template.pricing_header_text_color ?? null}
        initialPricingTextColor={template.pricing_text_color ?? null}
        initialPricingPriceTitleColor={template.pricing_price_title_color ?? null}
        initialPricingPriceColor={template.pricing_price_color ?? null}
        initialPricingPaymentScheduleNameColor={template.pricing_payment_schedule_name_color ?? null}
        initialPricingPaymentSchedulePriceColor={template.pricing_payment_schedule_price_color ?? null}
        initialPricingAccentBarColor={(template as { pricing_accent_bar_color?: string | null }).pricing_accent_bar_color ?? null}
        initialPricingDotColor={(template as { pricing_dot_color?: string | null }).pricing_dot_color ?? null}
        coverEntity={template}
      />
    </div>
  );
}
