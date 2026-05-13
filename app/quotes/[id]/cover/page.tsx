// app/quotes/[id]/cover/page.tsx
// Cover tab — own colour/gradient editor (Header Background card) plus the
// fields panel from the shared CoverEditor (image, subtitle, prepared by,
// date, client logo, accept button text). Two-column layout with the live
// quote preview on the right so changes show up immediately.
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
            <HeaderStyleCard proposal={proposal} companyId={companyId} onSaved={refetch} />
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <CoverEditor
                proposal={proposal}
                onSave={refetch}
                hideColors
                hideEnableToggle
                panelOnly
              />
            </div>
          </div>
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <PreviewPane proposal={proposal} companyId={companyId} />
          </aside>
        </div>
      </div>
    </div>
  );
}
