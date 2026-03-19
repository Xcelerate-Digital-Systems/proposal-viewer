// components/admin/shared/PricingPreview.tsx
'use client';

import { DollarSign } from 'lucide-react';
import { ProposalPricing } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PricingPage from '@/components/viewer/PricingPage';
import ViewerPagePreview from './ViewerPagePreview';

interface PricingPreviewProps {
  pricing: ProposalPricing;
  branding: CompanyBranding;
}

export default function PricingPreview({ pricing, branding }: PricingPreviewProps) {
  const count = pricing.items.length;
  return (
    <ViewerPagePreview
      branding={branding}
      label={pricing.title}
      icon={<DollarSign size={11} />}
      footer={`${count} item${count !== 1 ? 's' : ''} · Scales to fit`}
    >
      <PricingPage pricing={pricing} branding={branding} orientation="landscape" />
    </ViewerPagePreview>
  );
}
