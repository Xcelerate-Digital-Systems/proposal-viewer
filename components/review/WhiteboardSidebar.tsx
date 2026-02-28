// components/review/WhiteboardSidebar.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Globe, Mail, Smartphone, Image, Video, Megaphone, MessageSquare,
  CheckCircle2, AlertCircle, Eye, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { ReviewItem, ReviewComment, ReviewItemStatus } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';

/* ─── Props ────────────────────────────────────────────────────── */

interface WhiteboardSidebarProps {
  items: ReviewItem[];
  comments: ReviewComment[];
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

const STATUS_CONFIG: Record<ReviewItemStatus, { color: string; label: string }> = {
  draft: { color: '#9ca3af', label: 'Draft' },
  in_review: { color: '#60a5fa', label: 'In Review' },
  approved: { color: '#10b981', label: 'Approved' },
  revision_needed: { color: '#fbbf24', label: 'Revision Needed' },
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

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<string, ReviewItem[]> = {};
    for (const item of items) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    return groups;
  }, [items]);

  // Comment counts per item (top-level only)
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

  // If only one type, auto-expand
  const effectiveExpanded = types.length === 1 ? types[0] : expandedType;

  return (
    <div
      className="w-[220px] flex flex-col shrink-0 overflow-hidden"
      style={{
        backgroundColor: bgSecondary,
        borderRight: `1px solid ${sidebarText}15`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${sidebarText}12` }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{
            color: `${sidebarText}99`,
            fontFamily: fontFamily(branding.font_sidebar),
            fontWeight: branding.font_sidebar_weight || undefined,
          }}
        >
          Items
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: `${sidebarText}55` }}>
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
              {/* Type group header */}
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ color: `${sidebarText}88` }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${sidebarText}08`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {isExpanded ? (
                  <ChevronDown size={12} style={{ color: `${sidebarText}55` }} />
                ) : (
                  <ChevronRight size={12} style={{ color: `${sidebarText}55` }} />
                )}
                <TypeIcon size={13} />
                <span
                  className="text-[11px] font-medium uppercase tracking-wider flex-1 text-left"
                  style={{ fontFamily: fontFamily(branding.font_sidebar) }}
                >
                  {TYPE_LABELS[type] || type}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${sidebarText}10`, color: `${sidebarText}66` }}
                >
                  {typeItems.length}
                </span>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="pb-1">
                  {typeItems.map((item) => {
                    const status = STATUS_CONFIG[item.status];
                    const count = commentCounts[item.id] || 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectItem(item.id)}
                        className="w-full flex items-center gap-2.5 px-4 pl-8 py-2 text-left transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${sidebarText}08`)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Status dot */}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: status.color }}
                          title={status.label}
                        />

                        {/* Title */}
                        <span
                          className="text-xs truncate flex-1 min-w-0"
                          style={{
                            color: `${sidebarText}cc`,
                            fontFamily: fontFamily(branding.font_sidebar),
                            fontWeight: branding.font_sidebar_weight || undefined,
                          }}
                        >
                          {item.title}
                        </span>

                        {/* Comment count */}
                        {count > 0 && (
                          <span
                            className="flex items-center gap-1 text-[10px] shrink-0"
                            style={{ color: `${sidebarText}55` }}
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