'use client';

import { useState, useMemo } from 'react';
import {
  Globe, Mail, Smartphone, Image, Video, Megaphone, MessageSquare,
  CheckCircle2, AlertCircle, Eye, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { FeedbackItem, FeedbackComment, FeedbackStatus } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';
import { useBrandPalette } from '@/hooks/useBrandPalette';
import { withAlpha } from '@/lib/branding';

/* ─── Props ────────────────────────────────────────────────────── */

interface WhiteboardSidebarProps {
  items: FeedbackItem[];
  comments: FeedbackComment[];
  branding: CompanyBranding;
  bgSecondary: string;
  sidebarText: string;
  onSelectItem: (itemId: string) => void;
}

/* ─── Type icons ───────────────────────────────────────────────── */

const TYPE_ICONS: Record<string, typeof Globe> = {
  webpage: Globe,
  email: Mail,
  sms: Smartphone,
  image: Image,
  video: Video,
  ad: Megaphone,
};

const TYPE_LABELS: Record<string, string> = {
  webpage: 'Web Page',
  email: 'Email',
  sms: 'SMS',
  image: 'Image',
  video: 'Video',
  ad: 'Ad',
};

/* ─── Status config ────────────────────────────────────────────── */

import { getFeedbackStatusDef } from '@/lib/feedback/status';

const statusStyle = (status: FeedbackStatus) => {
  const s = getFeedbackStatusDef(status);
  return { color: s.hex, label: s.label };
};

/* ─── Component ────────────────────────────────────────────────── */

export default function WhiteboardSidebar({
  items,
  comments,
  branding,
  bgSecondary,
  sidebarText,
  onSelectItem,
}: WhiteboardSidebarProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const palette = useBrandPalette(branding);

  const groupedItems = useMemo(() => {
    const groups: Record<string, FeedbackItem[]> = {};
    for (const item of items) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    return groups;
  }, [items]);

  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of comments) {
      if (!c.parent_comment_id) {
        counts[c.review_item_id] = (counts[c.review_item_id] || 0) + 1;
      }
    }
    return counts;
  }, [comments]);

  const types = Object.keys(groupedItems).sort();
  const effectiveExpanded = types.length === 1 ? types[0] : expandedType;
  const hoverBg = withAlpha(palette.sidebarText, 0.03);

  return (
    <div
      data-wb-tour="sidebar"
      className="w-[220px] flex flex-col shrink-0 overflow-hidden"
      style={{
        backgroundColor: bgSecondary,
        borderRight: `1px solid ${palette.borderSubtle}`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${palette.borderSubtle}` }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{
            color: palette.mutedText,
            fontFamily: fontFamily(branding.font_sidebar),
            fontWeight: branding.font_sidebar_weight || undefined,
          }}
        >
          Items
        </p>
        <p className="text-2xs mt-0.5" style={{ color: palette.faintText }}>
          {items.length} item{items.length !== 1 ? 's' : ''} · {comments.filter((c) => !c.parent_comment_id).length} comments
        </p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto py-2">
        {types.map((type) => {
          const typeItems = groupedItems[type];
          const isExpanded = effectiveExpanded === type;
          const TypeIcon = TYPE_ICONS[type] || Eye;

          return (
            <div key={type}>
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ color: palette.mutedText }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {isExpanded ? (
                  <ChevronDown size={12} style={{ color: palette.faintText }} />
                ) : (
                  <ChevronRight size={12} style={{ color: palette.faintText }} />
                )}
                <TypeIcon size={13} />
                <span
                  className="text-detail font-medium uppercase tracking-wider flex-1 text-left"
                  style={{ fontFamily: fontFamily(branding.font_sidebar) }}
                >
                  {TYPE_LABELS[type] || type}
                </span>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: withAlpha(palette.sidebarText, 0.06), color: palette.faintText }}
                >
                  {typeItems.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {typeItems.map((item) => {
                    const status = statusStyle(item.status);
                    const count = commentCounts[item.id] || 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectItem(item.id)}
                        className="w-full flex items-center gap-2.5 px-4 pl-8 py-2 text-left transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: status.color }}
                          title={status.label}
                        />
                        <span
                          className="text-xs truncate flex-1 min-w-0"
                          style={{
                            color: palette.sidebarText,
                            fontFamily: fontFamily(branding.font_sidebar),
                            fontWeight: branding.font_sidebar_weight || undefined,
                          }}
                        >
                          {item.title}
                        </span>
                        {count > 0 && (
                          <span
                            className="flex items-center gap-1 text-2xs shrink-0"
                            style={{ color: palette.faintText }}
                          >
                            <MessageSquare size={10} />
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
