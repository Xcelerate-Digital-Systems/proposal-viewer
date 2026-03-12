// components/reviews/ItemSidebar.tsx
'use client';

import { Globe, Mail, Smartphone, Video } from 'lucide-react';
import type { ReviewItem, ReviewComment } from '@/lib/supabase';
import TypeFilterTabs from './TypeFilterTabs';

/* ─── Thumbnail renderer ─────────────────────────────────────────── */

function ItemThumbnail({
  item,
  textColor,
}: {
  item: ReviewItem;
  textColor: string;
}) {
  const thumbUrl = item.image_url || item.screenshot_url || item.ad_creative_url;

  if (item.type === 'webpage') {
    return (
      <div
        className="w-full aspect-video rounded overflow-hidden mb-1.5 flex items-center justify-center"
        style={{ backgroundColor: `${textColor}08` }}
      >
        <Globe size={20} style={{ color: `${textColor}44` }} />
      </div>
    );
  }

  if (item.type === 'email') {
    return (
      <div
        className="w-full aspect-video rounded overflow-hidden mb-1.5 flex flex-col items-center justify-center gap-1"
        style={{ backgroundColor: `${textColor}08` }}
      >
        <Mail size={16} style={{ color: `${textColor}44` }} />
        <span className="text-[9px] truncate max-w-full px-1" style={{ color: `${textColor}55` }}>
          {item.email_subject || 'Email'}
        </span>
      </div>
    );
  }

  if (item.type === 'sms') {
    return (
      <div
        className="w-full aspect-video rounded overflow-hidden mb-1.5 flex flex-col items-center justify-center gap-1"
        style={{ backgroundColor: `${textColor}08` }}
      >
        <Smartphone size={16} style={{ color: `${textColor}44` }} />
        <span className="text-[9px] truncate max-w-full px-1" style={{ color: `${textColor}55` }}>
          {item.sms_body ? `${item.sms_body.slice(0, 20)}…` : 'SMS'}
        </span>
      </div>
    );
  }

  if (item.type === 'video') {
    return (
      <div
        className="w-full aspect-video rounded overflow-hidden mb-1.5 flex items-center justify-center"
        style={{ backgroundColor: `${textColor}08` }}
      >
        <Video size={20} style={{ color: `${textColor}44` }} />
      </div>
    );
  }

  if (thumbUrl) {
    return (
      <div
        className="w-full aspect-video rounded overflow-hidden mb-1.5"
        style={{ backgroundColor: `${textColor}08` }}
      >
        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return null;
}

/* ─── Types ──────────────────────────────────────────────────────── */

interface ItemSidebarProps {
  /** All items (unfiltered — used for type counts) */
  items: ReviewItem[];
  /** Items after type filter applied */
  filteredItems: ReviewItem[];
  /** Available type values */
  availableTypes: string[];
  /** Current type filter (null = all) */
  typeFilter: string | null;
  /** Callback when filter changes */
  onFilterChange: (type: string | null) => void;
  /** Currently selected item ID */
  selectedItemId: string | null;
  /** Callback when an item is selected */
  onSelectItem: (itemId: string) => void;
  /** All comments — used for per-item unresolved count badges (only needs id, review_item_id, parent_comment_id, resolved) */
  comments?: Pick<ReviewComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[];

  // Theme
  /** 'admin' = white bg + gray borders, 'branded' = inline styles from branding */
  variant?: 'admin' | 'branded';

  // Header — admin shows project title, branded shows logo + title
  /** Project title shown at the top */
  projectTitle?: string;
  /** Logo URL (branded variant) */
  logoUrl?: string | null;
  /** Company name fallback (branded variant) */
  companyName?: string;

  // Branded colors
  /** Background color (branded variant) */
  bgColor?: string;
  /** Border color (branded variant) */
  borderColor?: string;
  /** Text color (branded variant) */
  textColor?: string;
  /** Accent color for badges */
  accentColor?: string;
  /** Font family for title (branded variant) */
  fontHeading?: string;
  /** Font family for sidebar items (branded variant) */
  fontSidebar?: string;
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function ItemSidebar({
  items,
  filteredItems,
  availableTypes,
  typeFilter,
  onFilterChange,
  selectedItemId,
  onSelectItem,
  comments = [],
  variant = 'admin',
  projectTitle,
  logoUrl,
  companyName,
  bgColor,
  borderColor,
  textColor,
  accentColor,
  fontHeading,
  fontSidebar,
}: ItemSidebarProps) {
  const isAdmin = variant === 'admin';

  // Colors — admin uses Tailwind, branded uses inline styles
  const bg = isAdmin ? undefined : bgColor;
  const border = isAdmin ? undefined : borderColor;
  const text = isAdmin ? '#111827' : (textColor || '#ffffff');
  const accent = isAdmin ? '#017C87' : (accentColor || '#01434A');

  return (
    <aside
      className={
        isAdmin
          ? 'flex flex-col w-[220px] shrink-0 border-r border-gray-200 bg-white overflow-hidden'
          : 'flex flex-col w-[220px] shrink-0 border-r overflow-hidden'
      }
      style={!isAdmin ? { backgroundColor: bg, borderColor: border } : undefined}
    >
      {/* Header */}
      <div
        className={isAdmin ? 'px-4 py-4 border-b border-gray-200' : 'px-4 py-4 border-b'}
        style={!isAdmin ? { borderColor: border } : undefined}
      >
        {!isAdmin && logoUrl ? (
          <img src={logoUrl} alt={companyName || ''} className="h-7 w-auto max-w-[160px] object-contain" />
        ) : !isAdmin && companyName ? (
          <span
            className="text-sm font-semibold"
            style={{ color: text, fontFamily: fontHeading }}
          >
            {companyName}
          </span>
        ) : null}

        {projectTitle && (
          <p
            className={isAdmin ? 'text-sm font-semibold text-gray-900 truncate' : 'text-xs mt-1.5 truncate'}
            style={!isAdmin ? { color: `${text}88` } : undefined}
          >
            {projectTitle}
          </p>
        )}
      </div>

      {/* Items list */}
      <nav className="flex-1 overflow-y-auto">
        {/* Type filter tabs */}
        <div className="px-2 pt-2 pb-1">
          <TypeFilterTabs
            items={items}
            availableTypes={availableTypes}
            typeFilter={typeFilter}
            onFilterChange={onFilterChange}
            variant={isAdmin ? 'admin' : 'branded'}
            sidebarTextColor={text}
          />
        </div>

        <div className="py-1 px-2 space-y-1">
          {filteredItems.map((item) => {
            const isActive = item.id === selectedItemId;
            const itemThreads = comments.filter(
              (c) => c.review_item_id === item.id && !c.parent_comment_id && !c.resolved
            ).length;

            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className={
                  isAdmin
                    ? `w-full text-left rounded-lg p-2 transition-colors ${
                        isActive ? 'bg-teal/8 ring-1 ring-teal/20' : 'hover:bg-gray-50'
                      }`
                    : 'w-full text-left rounded-lg p-2 transition-colors'
                }
                style={!isAdmin ? { backgroundColor: isActive ? `${text}12` : 'transparent' } : undefined}
              >
                <ItemThumbnail item={item} textColor={text} />

                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-xs font-medium truncate"
                    style={
                      isAdmin
                        ? { color: isActive ? '#017C87' : '#6b7280' }
                        : { color: isActive ? text : `${text}77`, fontFamily: fontSidebar }
                    }
                  >
                    {item.title}
                  </span>
                  {itemThreads > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      {itemThreads}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}