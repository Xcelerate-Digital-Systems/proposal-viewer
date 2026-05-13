// app/quotes/[id]/cover/page.tsx
// Cover tab — focused settings panel (image, subtitle, prepared by, date,
// client logo, accept button text) with CoverEditor's built-in cover-only
// preview on the right. Cover colours live on the Settings tab's Header
// Style card; the cover is always enabled on quotes.
'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import CoverEditor from '@/components/admin/proposals/CoverEditor';
import { useProposalDetail } from '@/components/admin/proposals/ProposalDetailContext';

export default function QuoteCoverPage() {
  const { proposal, refetch } = useProposalDetail();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-6 lg:px-10 py-6 space-y-5">
        <CoverEditor
          proposal={proposal}
          onSave={refetch}
          hideColors
          hideEnableToggle
        />

        {/* Wayfinding — cover colours, gradient and accept button colours all
            live on the Settings tab now, so make it discoverable. */}
        <Link
          href={`/quotes/${proposal.id}/settings`}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors group"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">Cover colours, gradient, fonts →</div>
            <div className="text-xs text-gray-400">
              Edit the header fill (solid / gradient), text colours, and accept button on the Settings tab.
            </div>
          </div>
          <ArrowUpRight size={16} className="text-gray-400 group-hover:text-teal transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );
}
