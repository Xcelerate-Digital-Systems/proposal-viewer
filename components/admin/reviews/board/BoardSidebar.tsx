// components/admin/reviews/board/BoardSidebar.tsx
'use client';

import { useState } from 'react';
import {
  Plus, X, Globe, Mail, Smartphone, Image, Video, Megaphone,
  ChevronDown, ChevronRight, Eye, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import type { ReviewItem, ReviewItemStatus } from '@/lib/supabase';

/* ─── Props ────────────────────────────────────────────────────── */

interface BoardSidebarProps {
  unplacedItems: ReviewItem[];
  placedItems: ReviewItem[];
  onPlaceItem: (itemId: string) => void;
  onRemoveFromBoard: (itemId: string) => void;
}

/* ─── Type icons ───────────────────────────────────────────────── */

const TYPE_ICONS: Record<string, React.ReactNode> = {
  webpage: <Globe size={13} />,
  email: <Mail size={13} />,
  sms: <Smartphone size={13} />,
  image: <Image size={13} />,
  video: <Video size={13} />,
  ad: <Megaphone size={13} />,
};

const TYPE_LABELS: Record<string, string> = {
  webpage: 'Web Page',
  email: 'Email',
  sms: 'SMS',
  image: 'Image',
  video: 'Video',
  ad: 'Ad',
};

/* ─── Status indicators ────────────────────────────────────────── */

const STATUS_DOT: Record<ReviewItemStatus, string> = {
  draft: 'bg-gray-300',
  in_review: 'bg-blue-400',
  approved: 'bg-emerald-500',
  revision_needed: 'bg-amber-400',
};

/* ─── Component ────────────────────────────────────────────────── */

export default function BoardSidebar({
  unplacedItems,
  placedItems,
  onPlaceItem,
  onRemoveFromBoard,
}: BoardSidebarProps) {
  const [showPlaced, setShowPlaced] = useState(false);

  return (
    <div className="w-[240px] border-r border-gray-200 bg-gray-50 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Items</h3>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {placedItems.length} on board · {unplacedItems.length} unplaced
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Unplaced items */}
        {unplacedItems.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
              Add to Board
            </p>
            <div className="space-y-1.5">
              {unplacedItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPlaceItem(item.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white border border-gray-200 hover:border-[#017C87]/40 hover:bg-[#017C87]/5 transition-all text-left group"
                >
                  {/* Type icon */}
                  <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 group-hover:bg-[#017C87]/10 group-hover:text-[#017C87] transition-colors">
                    {TYPE_ICONS[item.type] || <Eye size={13} />}
                  </div>

                  {/* Title & type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate leading-tight">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {TYPE_LABELS[item.type] || item.type}
                    </p>
                  </div>

                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />

                  {/* Add icon */}
                  <Plus size={14} className="text-gray-300 group-hover:text-[#017C87] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Placed items (collapsible) */}
        {placedItems.length > 0 && (
          <div className="border-t border-gray-200">
            <button
              onClick={() => setShowPlaced(!showPlaced)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 transition-colors"
            >
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                On Board ({placedItems.length})
              </span>
              {showPlaced ? (
                <ChevronDown size={12} className="text-gray-400" />
              ) : (
                <ChevronRight size={12} className="text-gray-400" />
              )}
            </button>

            {showPlaced && (
              <div className="px-3 pb-3 space-y-1">
                {placedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors group"
                  >
                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />

                    {/* Title */}
                    <p className="text-[11px] text-gray-600 truncate flex-1 min-w-0">
                      {item.title}
                    </p>

                    {/* Remove from board */}
                    <button
                      onClick={() => onRemoveFromBoard(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 transition-all"
                      title="Remove from board"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {unplacedItems.length === 0 && placedItems.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-400">No items in this project yet</p>
          </div>
        )}

        {/* All placed state */}
        {unplacedItems.length === 0 && placedItems.length > 0 && (
          <div className="px-4 py-6 text-center">
            <CheckCircle2 size={18} className="text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs text-gray-400">All items are on the board</p>
          </div>
        )}
      </div>
    </div>
  );
}