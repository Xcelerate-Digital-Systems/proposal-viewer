'use client';

import { Check, Eye, Globe, Mail, Smartphone } from 'lucide-react';
import type { FeedbackItem } from '@/lib/supabase';

interface Props {
  item: FeedbackItem;
}

/**
 * Thumbnail block rendered on a FeedbackItemCard. Picks the right preview
 * style based on `item.type` (webpage live preview / screenshot / icon,
 * email mini-preview, SMS bubble, image/ad thumbnail, fallback). Pure
 * presentation — no callbacks, no menus, no body content.
 */
export default function FeedbackItemThumb({ item }: Props) {
  const thumbnailUrl = item.image_url || item.screenshot_url || item.ad_creative_url;

  return (
    <>
      {item.type === 'webpage' ? (
        item.prefer_screenshot && item.screenshot_url ? (
          <div className="w-full h-full relative">
            <img
              src={item.screenshot_url}
              alt={item.title}
              className="w-full h-full object-cover object-top"
            />
            <WidgetStatusPill installedAt={item.widget_installed_at} />
          </div>
        ) : item.url ? (
          <div className="w-full h-full relative">
            <iframe
              src={item.url}
              title={item.title}
              className="absolute top-0 left-0 border-0 pointer-events-none"
              style={{
                width: '500%',
                height: '500%',
                transform: 'scale(0.2)',
                transformOrigin: 'top left',
              }}
              sandbox="allow-same-origin"
              loading="lazy"
              tabIndex={-1}
            />
            {/* Overlay so clicks pass through to the card button */}
            <div className="absolute inset-0 z-10" />
            <WidgetStatusPill installedAt={item.widget_installed_at} />
          </div>
        ) : item.screenshot_url ? (
          <div className="w-full h-full relative">
            <img
              src={item.screenshot_url}
              alt={item.title}
              className="w-full h-full object-cover object-top"
            />
            <WidgetStatusPill installedAt={item.widget_installed_at} />
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto">
              <Globe size={22} className="text-teal" />
            </div>
            {item.widget_installed_at ? (
              <div className="flex items-center gap-1 justify-center mt-2.5">
                <Check size={11} className="text-emerald-500" />
                <p className="text-xs text-emerald-600 font-medium">Connected</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600 mt-2.5">Awaiting install</p>
            )}
          </div>
        )
      ) : item.type === 'email' ? (
        <div className="w-full h-full flex flex-col text-left overflow-hidden bg-white">
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-teal/15 flex items-center justify-center shrink-0">
                <Mail size={10} className="text-teal" />
              </div>
              <span className="text-[10px] text-gray-400 truncate">Your Brand</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 truncate leading-snug">
              {item.email_subject || 'No subject'}
            </p>
            {item.email_preheader && (
              <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.email_preheader}</p>
            )}
          </div>
          <div className="flex-1 px-3 py-2 overflow-hidden">
            <p className="text-[10px] leading-relaxed text-gray-500 line-clamp-6 whitespace-pre-line">
              {item.email_body || item.html_content
                ? (item.email_body || item.html_content || '').replace(/<[^>]*>/g, '').slice(0, 300)
                : 'No content'}
            </p>
          </div>
        </div>
      ) : item.type === 'sms' ? (
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto">
            <Smartphone size={22} className="text-teal" />
          </div>
          <p className="text-xs text-gray-500 font-medium mt-2.5 truncate px-4 max-w-full">
            {item.sms_body ? `${item.sms_body.slice(0, 30)}…` : 'SMS'}
          </p>
        </div>
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
      ) : (
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
            <Eye size={22} className="text-gray-300" />
          </div>
          <p className="text-xs text-gray-400 mt-2.5">No preview</p>
        </div>
      )}

      {/* Type badge overlay */}
      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-500 capitalize shadow-sm">
        {item.type === 'ad' ? 'Meta Ad' : item.type === 'webpage' ? 'Web Page' : item.type}
      </span>

      {/* Version badge */}
      {item.version > 1 && (
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-500 shadow-sm">
          v{item.version}
        </span>
      )}
    </>
  );
}

/* ─── Local helper ─────────────────────────────────────────────────── */

function WidgetStatusPill({ installedAt }: { installedAt: string | null | undefined }) {
  return (
    <div className="absolute bottom-2 left-2 z-20">
      {installedAt ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
          <Check size={9} /> Connected
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
          Awaiting install
        </span>
      )}
    </div>
  );
}
