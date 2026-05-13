// app/quotes/[id]/cover/page.tsx
// Cover tab — mirrors the builder/settings layout: left column stacks the
// cover-specific editors, right column shows the same sticky live PreviewPane
// used by the other tabs. The cover splash and quote-body header are
// independent — quote-body header editing lives on the Settings tab.
'use client';

import CoverEditor from '@/components/admin/proposals/CoverEditor';
import HeaderStyleCard from '@/components/admin/quotes/HeaderStyleCard';
import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteCoverPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 lg:px-10 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 space-y-5">
            <HeaderStyleCard
              proposal={proposal}
              companyId={companyId}
              onSaved={refetch}
              variant="cover"
            />

            {/* panelOnly = CoverEditor renders just its settings panel; the
                live preview comes from PreviewPane on the right so this tab
                matches the builder/settings layout exactly. */}
            <CoverEditor
              proposal={proposal}
              onSave={refetch}
              hideColors
              hideEnableToggle
              panelOnly
            />
          </div>

          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <PreviewPane proposal={proposal} companyId={companyId} />
          </aside>
        </div>
      </div>
    </div>
  );
}
