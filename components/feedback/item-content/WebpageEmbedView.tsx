'use client';

import { useState } from 'react';
import {
  CheckCircle2, Check, Clock, Code2, Copy, ExternalLink, Globe,
} from 'lucide-react';
import type { FeedbackItem } from '@/lib/supabase';

interface Props {
  item: FeedbackItem;
  shareToken: string;
}

/**
 * Setup view shown for webpage items that don't yet have a screenshot — the
 * agency hasn't installed the widget on the live page. Renders the embed
 * script + the install state. Once a screenshot is captured by the widget,
 * we switch to WebpagePreviewView.
 */
export default function WebpageEmbedView({ item, shareToken }: Props) {
  const [copied, setCopied] = useState(false);

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
      // Fallback for environments where the clipboard API is blocked
      const ta = document.createElement('textarea');
      ta.value = scriptTag;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center mx-auto mb-4">
            <Globe size={24} className="text-teal" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Feedback Widget</h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Embed this script on your page to enable the feedback widget. Visitors can leave
            comments, take screenshots, and record their screen.
          </p>
        </div>

        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            isInstalled
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">Widget installed</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Detected on {new Date(item.widget_installed_at!).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">Awaiting installation</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Add the script below to your page&apos;s <code className="font-mono">&lt;head&gt;</code> tag
                </p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Code2 size={13} />
              Embed Code
            </label>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-teal hover:bg-teal/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <div
            onClick={handleCopy}
            className="relative bg-gray-900 rounded-xl p-4 cursor-pointer group"
          >
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">
              {scriptTag || '/* Missing share token or item ID */'}
            </pre>
            <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-teal/30 transition-colors" />
          </div>
        </div>

        {item.url && (
          <div className="flex items-center justify-center gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-teal-hover transition-colors"
            >
              <ExternalLink size={14} />
              Open Page
            </a>
          </div>
        )}

        {item.url && (
          <p className="text-center text-xs text-gray-400 truncate px-4">{item.url}</p>
        )}
      </div>
    </div>
  );
}
