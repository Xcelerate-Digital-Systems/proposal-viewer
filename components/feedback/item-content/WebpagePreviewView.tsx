'use client';

import { useState } from 'react';
import { Check, Clock, Code2, Copy, ExternalLink } from 'lucide-react';
import PinOverlay from '@/components/feedback/PinOverlay';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';

interface Props {
  item: FeedbackItem;
  shareToken: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  pinComments: FeedbackComment[];
  onPinClick: (commentId?: string) => void;
}

/**
 * Display view for webpage items once the widget has captured a screenshot.
 * Shows the screenshot with read-only pins (creation happens via the
 * widget on the live page), plus a collapsible drawer with the embed
 * snippet.
 */
export default function WebpagePreviewView({
  item,
  shareToken,
  containerRef,
  pinComments,
  onPinClick,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  const apiBase = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || '';

  const scriptTag = shareToken && item.id
    ? `<script src="${apiBase}/api/review-widget/${shareToken}/script?item=${item.id}" defer><\/script>`
    : '';

  const isInstalled = !!item.widget_installed_at;

  const handleCopy = async () => {
    if (!scriptTag) return;
    try {
      await navigator.clipboard.writeText(scriptTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail — clipboard APIs are best-effort
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
        <img
          src={item.screenshot_url!}
          alt={item.title}
          className="w-full h-full object-contain object-top bg-white"
        />

        <PinOverlay
          pinComments={pinComments}
          pendingPin={null}
          onPinClick={onPinClick}
        />

        <div className="absolute top-4 left-4 right-4 flex items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm shadow-sm border border-gray-200/70">
            {isInstalled ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-700">Widget connected</span>
              </>
            ) : (
              <>
                <Clock size={12} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Awaiting install</span>
              </>
            )}
          </div>

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm shadow-sm border border-gray-200/70 text-xs font-medium text-gray-700 hover:text-teal hover:border-teal/30 transition-colors"
            >
              <ExternalLink size={12} />
              Open live page
            </a>
          )}

          <div className="ml-auto flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowEmbed((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm shadow-sm border border-gray-200/70 text-xs font-medium text-gray-700 hover:text-teal hover:border-teal/30 transition-colors"
            >
              <Code2 size={12} />
              {showEmbed ? 'Hide embed code' : 'Embed code'}
            </button>
          </div>
        </div>
      </div>

      {showEmbed && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Widget embed script</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Paste this into the page&apos;s <code className="font-mono">&lt;head&gt;</code> tag.
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div onClick={handleCopy} className="relative bg-gray-900 rounded-lg p-3 cursor-pointer">
            <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
              {scriptTag || '/* Missing share token or item ID */'}
            </pre>
          </div>
          {item.widget_installed_at && (
            <p className="text-[11px] text-gray-400">
              Last detected {new Date(item.widget_installed_at).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
