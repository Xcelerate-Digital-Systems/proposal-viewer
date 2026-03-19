// components/admin/shared/PackagesPreview.tsx
'use client';

import { Package } from 'lucide-react';
import { ProposalPackages } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import PackagesPage from '@/components/viewer/PackagesPage';
import ViewerPagePreview from './ViewerPagePreview';

interface PackagesPreviewProps {
  packages: ProposalPackages;
  branding: CompanyBranding;
}

export default function PackagesPreview({ packages, branding }: PackagesPreviewProps) {
  const count = (packages.packages ?? []).length;

  const emptyState = count === 0 ? (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: branding.bg_primary || '#0f0f0f' }}
    >
      <div className="text-center">
        <Package size={32} className="mx-auto mb-3" style={{ color: `${branding.sidebar_text_color || '#ffffff'}55` }} />
        <p className="text-sm" style={{ color: `${branding.sidebar_text_color || '#ffffff'}88` }}>Add packages to see a preview</p>
      </div>
    </div>
  ) : undefined;

  return (
    <ViewerPagePreview
      branding={branding}
      label={packages.title}
      icon={<Package size={11} />}
      footer={`${count} package${count !== 1 ? 's' : ''} · Scales to fit`}
      emptyState={emptyState}
    >
      <PackagesPage packages={packages} branding={branding} orientation="landscape" />
    </ViewerPagePreview>
  );
}
