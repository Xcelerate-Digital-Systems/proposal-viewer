'use client';

import { useEffect, useRef } from 'react';
import { Globe, Mail, Smartphone, Video } from 'lucide-react';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';

/* ─── Small thumbnail (~72×44) ───────────────────────────────────── */

function ThumbPreview({ item, textColor }: { item: FeedbackItem; textColor: string }) {
  const thumbUrl = item.image_url || item.screenshot_url || item.ad_creative_url;
  const iconTint = `${textColor}44`;
  const bg = `${textColor}08`;

  if (thumbUrl) {
    return (
      <div className="w-full h-full" style={{ backgroundColor: bg }}>
        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  let Icon = Globe;
  if (item.type === 'email') Icon = Mail;
  else if (item.type === 'sms') Icon = Smartphone;
  else if (item.type === 'video') Icon = Video;

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      <Icon size={14} style={{ color: iconTint }} />
    </div>
  );
}

/* ─── Types ──────────────────────────────────────────────────────── */

interface ItemThumbStripProps {
  filteredItems: FeedbackItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  comments?: Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[];

  variant?: 'admin' | 'branded';
  textColor?: string;
  accentColor?: string;
  fontSidebar?: string;
  className?: string;
}

/* ─── Component — horizontal scrollable strip only ──────────────── */

export default function ItemThumbStrip({
  filteredItems,
  selectedItemId,
  onSelectItem,
  comments = [],
  variant = 'admin',
  textColor,
  accentColor,
  fontSidebar,
  className,
}: ItemThumbStripProps) {
  const isAdmin = variant === 'admin';
  const text = isAdmin ? '#111827' : (textColor || '#ffffff');
  const accent = isAdmin ? '#017C87' : (accentColor || '#01434A');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedItemId || !scrollRef.current) return;
    const node = scrollRef.current.querySelector<HTMLButtonElement>(
      `[data-thumb-id="${selectedItemId}"]`
    );
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedItemId]);

  return (
    <div
      ref={scrollRef}
      // py-1.5 gives the ring + notification badge room to sit inside the
      // scroll container — with overflow-x:auto, CSS coerces overflow-y to
      // auto too, so anything extending past the edge would otherwise clip.
      className={`flex items-center gap-1.5 overflow-x-auto py-1.5 ${className || ''}`}
      style={{ scrollbarWidth: 'thin' }}
    >
      {filteredItems.map((item) => {
        const isActive = item.id === selectedItemId;
        const threads = comments.filter(
          (c) => c.review_item_id === item.id && !c.parent_comment_id && !c.resolved
        ).length;

        const activeClass = isAdmin
          ? (isActive
              ? 'ring-2 ring-teal ring-offset-1 ring-offset-white'
              : 'ring-1 ring-gray-200 hover:ring-gray-300')
          : '';

        return (
          <button
            key={item.id}
            data-thumb-id={item.id}
            onClick={() => onSelectItem(item.id)}
            title={item.title}
            className={`relative shrink-0 w-[64px] h-[40px] rounded-md overflow-hidden transition-all ${activeClass}`}
            style={
              !isAdmin
                ? {
                    boxShadow: isActive
                      ? `0 0 0 2px ${text}, 0 0 0 4px ${text}22`
                      : `inset 0 0 0 1px ${text}22`,
                  }
                : undefined
            }
          >
            <ThumbPreview item={item} textColor={text} />

            {threads > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] leading-none font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: accent,
                  color: isAdmin ? '#ffffff' : text,
                  fontFamily: fontSidebar,
                }}
              >
                {threads}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
