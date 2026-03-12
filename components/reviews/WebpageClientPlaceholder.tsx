// components/reviews/WebpageClientPlaceholder.tsx
'use client';

import { Globe, ExternalLink } from 'lucide-react';
import { type ReviewItem } from '@/lib/supabase';

/**
 * Placeholder shown for webpage-type items in client/public viewers.
 * Directs users to visit the live page to leave feedback via the installed widget.
 * Replaces the identical renderWebpageClientView callback duplicated in review/project pages.
 */
export default function WebpageClientPlaceholder({ item }: { item: ReviewItem }) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center mx-auto mb-4">
          <Globe size={24} className="text-teal" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Leave feedback on the live page
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          This page has a feedback widget installed. Visit the page directly to
          leave pin comments, take screenshots, and record your screen.
        </p>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-[#015c64] transition-colors"
          >
            <ExternalLink size={14} />
            Visit Page
          </a>
        )}
        {item.url && (
          <p className="text-xs text-gray-400 mt-3 truncate px-4">{item.url}</p>
        )}
      </div>
    </div>
  );
}