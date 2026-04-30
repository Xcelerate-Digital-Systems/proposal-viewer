'use client';

import { useMemo, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import type { FeedbackItem, FeedbackComment } from '@/lib/types/feedback';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import FeedbackItemThumb from '@/components/admin/feedback/FeedbackItemThumb';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';

interface PublicItemsGridProps {
  items: FeedbackItem[];
  comments: FeedbackComment[];
  initialTypeFilter?: string | null;
  onSelectItem: (itemId: string) => void;
}

/**
 * Public read-only items grid. Mirrors the admin `/feedback/[id]/items`
 * card layout — type filter chips above a responsive thumbnail grid —
 * stripped of edit / delete / share menus. Clicking a card delegates
 * to the parent which opens the item detail inline.
 */
export default function PublicItemsGrid({
  items, comments, initialTypeFilter, onSelectItem,
}: PublicItemsGridProps) {
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeFilter ?? null);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type))).sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const commentCounts = useMemo(() => {
    const counts: Record<string, { total: number; unresolved: number }> = {};
    for (const c of comments) {
      if (c.parent_comment_id) continue;
      const id = c.review_item_id;
      if (!counts[id]) counts[id] = { total: 0, unresolved: 0 };
      counts[id].total += 1;
      if (!c.resolved) counts[id].unresolved += 1;
    }
    return counts;
  }, [comments]);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-semibold text-gray-500 mb-1">No items yet</h3>
        <p className="text-sm text-gray-400">Nothing to review just yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-6 lg:px-10 pb-8 pt-4">
      <TypeFilterTabs
        items={items}
        availableTypes={availableTypes}
        typeFilter={typeFilter}
        onFilterChange={setTypeFilter}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {filteredItems.map((item) => {
          const counts = commentCounts[item.id] ?? { total: 0, unresolved: 0 };
          const statusDef = getFeedbackStatusDef(item.status);
          return (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className="group relative bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_4px_rgba(20,20,40,0.06),0_8px_24px_rgba(20,20,40,0.08)] transition-all overflow-hidden text-left flex flex-col"
            >
              <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                <FeedbackItemThumb item={item} />
              </div>
              <div className="p-3.5 flex-1 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <h3 className="text-[13px] font-semibold text-ink leading-tight flex-1 min-w-0 truncate">
                    {item.title}
                  </h3>
                  {item.version > 1 && (
                    <span className="text-[10px] font-semibold text-gray-400 shrink-0">v{item.version}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusDef.bg} ${statusDef.text} ${statusDef.border}`}
                  >
                    {statusDef.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                    <MessageSquareText size={11} />
                    {counts.total}
                    {counts.unresolved > 0 && (
                      <span className="text-amber-600 font-semibold">({counts.unresolved})</span>
                    )}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
