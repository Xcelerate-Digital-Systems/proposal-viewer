'use client';

import { RotateCcw, DollarSign } from 'lucide-react';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { PricingDesignPreview, type FontLiveOverrides } from '@/components/admin/builder-sections/DesignPreviews';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import type { TextPageDefaults } from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PricingGroupProps {
  entityId: string;
  entityKey: 'template_id' | 'proposal_id';
  companyDefaults: TextPageDefaults;
  liveFonts: FontLiveOverrides;
  /* Pricing colours */
  pricingHeaderTextColor: string | null;
  setPricingHeaderTextColor: (v: string | null) => void;
  pricingTextColor: string | null;
  setPricingTextColor: (v: string | null) => void;
  pricingPriceTitleColor: string | null;
  setPricingPriceTitleColor: (v: string | null) => void;
  pricingPriceColor: string | null;
  setPricingPriceColor: (v: string | null) => void;
  pricingPaymentScheduleNameColor: string | null;
  setPricingPaymentScheduleNameColor: (v: string | null) => void;
  pricingPaymentSchedulePriceColor: string | null;
  setPricingPaymentSchedulePriceColor: (v: string | null) => void;
  pricingAccentBarColor: string | null;
  setPricingAccentBarColor: (v: string | null) => void;
  pricingDotColor: string | null;
  setPricingDotColor: (v: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PricingGroup({
  entityId,
  entityKey,
  companyDefaults,
  liveFonts,
  pricingHeaderTextColor,
  setPricingHeaderTextColor,
  pricingTextColor,
  setPricingTextColor,
  pricingPriceTitleColor,
  setPricingPriceTitleColor,
  pricingPriceColor,
  setPricingPriceColor,
  pricingPaymentScheduleNameColor,
  setPricingPaymentScheduleNameColor,
  pricingPaymentSchedulePriceColor,
  setPricingPaymentSchedulePriceColor,
  pricingAccentBarColor,
  setPricingAccentBarColor,
  pricingDotColor,
  setPricingDotColor,
}: PricingGroupProps) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        <SectionCard
          title="Pricing Design"
          description="Colour the pricing page that appears inside the proposal. Body background, card chrome and headings still inherit from Globals."
          icon={<DollarSign size={14} className="text-faint" />}
          action={
            <button
              onClick={() => {
                setPricingHeaderTextColor(null);
                setPricingTextColor(null);
                setPricingPriceTitleColor(null);
                setPricingPriceColor(null);
                setPricingPaymentScheduleNameColor(null);
                setPricingPaymentSchedulePriceColor(null);
                setPricingAccentBarColor(null);
                setPricingDotColor(null);
              }}
              className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            <ColorPickerField
              label="Header Text"
              value={pricingHeaderTextColor}
              fallback={companyDefaults.heading_color || companyDefaults.text_color}
              onChange={setPricingHeaderTextColor}
              onReset={() => setPricingHeaderTextColor(null)}
            />
            <ColorPickerField
              label="Text"
              value={pricingTextColor}
              fallback={companyDefaults.text_color}
              onChange={setPricingTextColor}
              onReset={() => setPricingTextColor(null)}
            />
            <ColorPickerField
              label="Price Title"
              value={pricingPriceTitleColor}
              fallback={companyDefaults.heading_color || companyDefaults.text_color}
              onChange={setPricingPriceTitleColor}
              onReset={() => setPricingPriceTitleColor(null)}
            />
            <ColorPickerField
              label="Price"
              value={pricingPriceColor}
              fallback={companyDefaults.heading_color || companyDefaults.text_color}
              onChange={setPricingPriceColor}
              onReset={() => setPricingPriceColor(null)}
            />
            <ColorPickerField
              label="Payment Schedule Name"
              value={pricingPaymentScheduleNameColor}
              fallback={companyDefaults.accent_color}
              onChange={setPricingPaymentScheduleNameColor}
              onReset={() => setPricingPaymentScheduleNameColor(null)}
            />
            <ColorPickerField
              label="Payment Schedule Price"
              value={pricingPaymentSchedulePriceColor}
              fallback={companyDefaults.accent_color}
              onChange={setPricingPaymentSchedulePriceColor}
              onReset={() => setPricingPaymentSchedulePriceColor(null)}
            />
            <ColorPickerField
              label="Top Border Bar"
              value={pricingAccentBarColor}
              fallback={companyDefaults.accent_color}
              onChange={setPricingAccentBarColor}
              onReset={() => setPricingAccentBarColor(null)}
            />
            <ColorPickerField
              label="Dot / Bullet Colour"
              value={pricingDotColor}
              fallback={companyDefaults.accent_color}
              onChange={setPricingDotColor}
              onReset={() => setPricingDotColor(null)}
            />
          </div>
        </SectionCard>
      </div>
      <StickyPreviewAside>
        <PricingDesignPreview
          entityId={entityId}
          entityKey={entityKey}
          live={{
            pricing_header_text_color: pricingHeaderTextColor,
            pricing_text_color: pricingTextColor,
            pricing_price_title_color: pricingPriceTitleColor,
            pricing_price_color: pricingPriceColor,
            pricing_payment_schedule_name_color: pricingPaymentScheduleNameColor,
            pricing_payment_schedule_price_color: pricingPaymentSchedulePriceColor,
            pricing_accent_bar_color: pricingAccentBarColor,
            pricing_dot_color: pricingDotColor,
          }}
          liveFonts={liveFonts}
        />
      </StickyPreviewAside>
    </div>
  );
}
