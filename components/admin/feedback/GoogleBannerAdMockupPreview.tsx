'use client';

interface Props {
  headline: string;
  displayUrl: string;
  creativeUrl?: string;
}

/** Display network banner preview (336×280-ish). */
export default function GoogleBannerAdMockupPreview({ headline, displayUrl, creativeUrl }: Props) {
  return (
    <div className="w-full max-w-[336px] bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="w-full aspect-[336/280] bg-gray-50 relative">
        {creativeUrl ? (
          <img src={creativeUrl} alt="Ad banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">336 × 280</div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{headline || 'Your Headline'}</p>
            <p className="text-2xs text-gray-400 truncate">{displayUrl || 'example.com'}</p>
          </div>
          <span className="text-2xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">Ad</span>
        </div>
      </div>
    </div>
  );
}
