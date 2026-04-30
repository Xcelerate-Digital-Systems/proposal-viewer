'use client';

import { useMemo } from 'react';
import {
  MessageSquareText, ExternalLink, Globe, Mail, Smartphone,
  Image as ImageIcon, Video, FileText, Megaphone, Search,
} from 'lucide-react';
import type { FeedbackItem, FeedbackItemType, FeedbackStatus, FeedbackComment } from '@/lib/types/feedback';
import { REVIEW_STATUS_ORDER, getFeedbackStatusDef } from '@/lib/feedback/status';

interface PublicKanbanViewProps {
  items: FeedbackItem[];
  comments: FeedbackComment[];
  onSelectItem: (itemId: string) => void;
}

const TYPE_META: Record<FeedbackItemType, { label: string; Icon: typeof Globe; iconBg: string; iconColor: string }> = {
  webpage:   { label: 'Webpage',   Icon: Globe,      iconBg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  email:     { label: 'Email',     Icon: Mail,       iconBg: 'bg-violet-50',  iconColor: 'text-violet-600' },
  sms:       { label: 'SMS',       Icon: Smartphone, iconBg: 'bg-green-50',   iconColor: 'text-green-600' },
  image:     { label: 'Image',     Icon: ImageIcon,  iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  video:     { label: 'Video',     Icon: Video,      iconBg: 'bg-rose-50',    iconColor: 'text-rose-600' },
  pdf:       { label: 'PDF',       Icon: FileText,   iconBg: 'bg-red-50',     iconColor: 'text-red-600' },
  ad:        { label: 'Meta Ad',   Icon: Megaphone,  iconBg: 'bg-blue-50',    iconColor: 'text-blue-600' },
  google_ad: { label: 'Google Ad', Icon: Search,     iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600' },
};

/**
 * Read-only kanban for public reviewers. Same column layout as the admin
 * board but no drag handles and no status mutations — clients tap a card
 * to open the item detail view where they can comment.
 */
export default function PublicKanbanView({ items, comments, onSelectItem }: PublicKanbanViewProps) {
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

  const columns = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackItem[]> = REVIEW_STATUS_ORDER.reduce((acc, s) => {
      acc[s] = [];
      return acc;
    }, {} as Record<FeedbackStatus, FeedbackItem[]>);
    for (const item of items) {
      const key = (REVIEW_STATUS_ORDER.includes(item.status) ? item.status : 'draft') as FeedbackStatus;
      map[key].push(item);
    }
    for (const key of REVIEW_STATUS_ORDER) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [items]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-6 lg:px-10 h-full">
      {REVIEW_STATUS_ORDER.map((status) => {
        const def = getFeedbackStatusDef(status);
        const columnItems = columns[status];
        return (
          <div key={status} className="shrink-0 w-[280px] flex flex-col h-full min-h-0">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <span className={`w-2 h-2 rounded-full ${def.dot}`} />
              <h3 className="text-[13px] font-semibold text-gray-800">{def.label}</h3>
              <span className="text-[11px] font-medium text-gray-400">{columnItems.length}</span>
            </div>
            <div className="flex-1 rounded-2xl p-3 space-y-2.5 overflow-y-auto bg-gray-50">
              {columnItems.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic text-center py-4">Empty</div>
              ) : (
                columnItems.map((item) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.Icon;
                  const counts = commentCounts[item.id] ?? { total: 0, unresolved: 0 };
                  const isWebpage = item.type === 'webpage';
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem(item.id)}
                      className="w-full text-left group relative bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_2px_8px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_4px_rgba(20,20,40,0.06),0_8px_20px_rgba(20,20,40,0.06)] p-3.5 transition-all"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.iconBg}`}>
                          <Icon size={15} className={meta.iconColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5">
                            <h4 className="text-[13px] font-medium text-ink truncate leading-tight flex-1 min-w-0">
                              {item.title}
                            </h4>
                            {item.version > 1 && (
                              <span className="text-[10px] font-semibold text-gray-400 shrink-0">v{item.version}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta.label}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                          <MessageSquareText size={11} />
                          <span>
                            {counts.total}
                            {counts.unresolved > 0 && (
                              <span className="text-amber-600 ml-0.5 font-semibold">({counts.unresolved})</span>
                            )}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal">
                          {isWebpage ? <ExternalLink size={11} /> : null}
                          Open
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
