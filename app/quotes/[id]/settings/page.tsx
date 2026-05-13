// app/quotes/[id]/settings/page.tsx
// Settings tab — three focused cards (Page Background, Header Style,
// Fonts & Font Colours) with a sticky live preview so the user can see
// changes as they make them.
'use client';

import QuoteSettingsPanel from '@/components/admin/quotes/QuoteSettingsPanel';
import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteSettingsPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 lg:px-10 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 space-y-5">
            <QuoteSettingsPanel proposal={proposal} companyId={companyId} onSaved={refetch} />
          </div>
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <PreviewPane proposal={proposal} companyId={companyId} />
          </aside>
        </div>
      </div>
    </div>
  );
}
