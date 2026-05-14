// app/quotes/[id]/cover/page.tsx
// Cover tab — stacks the HeaderStyleCard above the CoverEditor. CoverEditor
// renders its own built-in cover preview alongside its settings panel, which
// is the right thing for this tab (the tab is about the cover only — the
// full-quote preview belongs on builder/settings).
'use client';

import CoverEditor from '@/components/admin/proposals/CoverEditor';
import HeaderStyleCard from '@/components/admin/quotes/HeaderStyleCard';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteCoverPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 lg:px-10 py-6 space-y-5">
        <HeaderStyleCard
          proposal={proposal}
          companyId={companyId}
          onSaved={refetch}
          variant="cover"
        />

        <CoverEditor
          proposal={proposal}
          onSave={refetch}
          hideColors
          hideEnableToggle
        />
      </div>
    </div>
  );
}
