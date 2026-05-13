// app/quotes/[id]/cover/page.tsx
// Cover tab — fully independent from the quote body. Editor stack:
//   1. HeaderStyleCard (variant=cover) — edits cover_* columns
//      with the interactive drag-to-place gradient preview.
//   2. CoverEditor (non-panelOnly) — fields panel + built-in cover preview
//      so the user sees just the cover splash, not the full quote.
// The Quote Header Background lives on the Settings tab and is independent.
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

        {/* Non-panelOnly = CoverEditor renders its own split (left fields
            panel + right cover preview), so the user sees only the cover —
            not the full quote — alongside their edits. */}
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
