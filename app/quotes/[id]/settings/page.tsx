// app/quotes/[id]/settings/page.tsx
// Settings tab — cover design + quote design with dual sticky previews
// (cover preview on top, full-quote preview below) so the user sees both
// surfaces update in real-time as they tweak colours and fonts.
'use client';

import QuoteSettingsPanel from '@/components/admin/quotes/QuoteSettingsPanel';
import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';
import QuoteCoverPreview from '@/components/admin/quotes/QuoteCoverPreview';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteSettingsPage() {
  const { proposal, refetch, companyId } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 lg:px-10 py-6">
        <div className="flex gap-6 items-start">
          {/* Left: stacked design controls */}
          <div className="flex-1 min-w-0 space-y-5">
            <QuoteSettingsPanel proposal={proposal} companyId={companyId} onSaved={refetch} />
          </div>

          {/* Right: dual sticky previews */}
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0 self-stretch">
            <div className="sticky top-6 space-y-4">
              <QuoteCoverPreview proposal={proposal} companyId={companyId} />
              <PreviewPane proposal={proposal} companyId={companyId} noSticky />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
