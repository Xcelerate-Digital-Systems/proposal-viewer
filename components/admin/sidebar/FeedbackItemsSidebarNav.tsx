'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, X, ChevronDown, ChevronRight, CheckCircle2,
  Globe, Mail, Smartphone, Image as ImageIcon, Video, Megaphone, FileText, Eye, ClipboardList, Search, RectangleHorizontal,
} from 'lucide-react';
import { useFeedbackBoardContext } from '@/components/admin/feedback/board/FeedbackBoardContext';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import type { FeedbackItemType } from '@/lib/supabase';

const TYPE_ICONS: Record<FeedbackItemType, React.ReactNode> = {
  webpage: <Globe size={13} />,
  email: <Mail size={13} />,
  sms: <Smartphone size={13} />,
  image: <ImageIcon size={13} />,
  video: <Video size={13} />,
  ad: <Megaphone size={13} />,
  google_search_ad: <Search size={13} />,
  google_banner_ad: <RectangleHorizontal size={13} />,
  pdf: <FileText size={13} />,
  meta_lead_form: <ClipboardList size={13} />,
};

const TYPE_LABELS: Record<FeedbackItemType, string> = {
  webpage: 'Web Page',
  email: 'Email',
  sms: 'SMS',
  image: 'Image',
  video: 'Video',
  ad: 'Meta Ad',
  google_search_ad: 'Google Search Ad',
  google_banner_ad: 'Google Banner Ad',
  pdf: 'PDF',
  meta_lead_form: 'Lead Form',
};

export default function FeedbackItemsSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const ctx = useFeedbackBoardContext();
  const [showPlaced, setShowPlaced] = useState(false);

  if (!ctx) {
    return (
      <div className="px-3 py-4 text-xs text-white/40">Loading project…</div>
    );
  }

  const { project, placedItems, unplacedItems, placeItem, removeItemFromBoard, openAddItem, loading } = ctx;

  return (
    <>
      <Link
        href="/feedback"
        onClick={onNavigate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#013036] transition-colors mb-1"
      >
        <ArrowLeft size={14} />
        <span>All Projects</span>
      </Link>

      <div className="px-3 pt-1 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Feedback Project
        </div>
        <div className="text-sm font-semibold text-white mt-0.5 truncate">
          {project?.title || '…'}
        </div>
        {project?.client_name && (
          <div className="text-[11px] text-white/50 truncate">{project.client_name}</div>
        )}
      </div>

      <div className="border-t border-[#01434A] my-2" />

      <div className="px-3 pt-1 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Add to Board
        </span>
        <span className="text-[10px] text-white/30">
          {unplacedItems.length}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-white/40 px-3 py-2">Loading…</p>
      ) : unplacedItems.length === 0 ? (
        placedItems.length > 0 ? (
          <div className="px-3 py-3 flex items-center gap-2 text-xs text-white/50">
            <CheckCircle2 size={14} className="text-[#8AD9D1]" />
            All items on the board
          </div>
        ) : (
          <p className="text-xs text-white/40 px-3 py-2">No items yet</p>
        )
      ) : (
        <div className="space-y-0.5">
          {unplacedItems.map((item) => {
            const statusDef = getFeedbackStatusDef(item.status);
            return (
              <button
                key={item.id}
                onClick={() => placeItem(item.id)}
                className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left text-white/70 hover:text-white hover:bg-[#013036]"
              >
                <span className="w-5 flex justify-center text-white/40 group-hover:text-[#8AD9D1]">
                  {TYPE_ICONS[item.type] || <Eye size={13} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate leading-tight">{item.title}</span>
                  <span className="block text-[10px] text-white/40 leading-tight">
                    {TYPE_LABELS[item.type]}
                  </span>
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDef.dot}`} />
                <Plus size={13} className="text-white/30 group-hover:text-[#8AD9D1] transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={openAddItem}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#8AD9D1] hover:bg-[#013036] transition-colors mt-2"
      >
        <Plus size={15} />
        New Item
      </button>

      {placedItems.length > 0 && (
        <>
          <div className="border-t border-[#01434A] my-3" />
          <button
            onClick={() => setShowPlaced(!showPlaced)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#013036] transition-colors"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              On Board ({placedItems.length})
            </span>
            {showPlaced ? (
              <ChevronDown size={12} className="text-white/40" />
            ) : (
              <ChevronRight size={12} className="text-white/40" />
            )}
          </button>

          {showPlaced && (
            <div className="space-y-0.5 mt-1">
              {placedItems.map((item) => {
                const statusDef = getFeedbackStatusDef(item.status);
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#013036] transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDef.dot}`} />
                    <span className="flex-1 text-[12px] text-white/60 truncate">{item.title}</span>
                    <button
                      onClick={() => removeItemFromBoard(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/40 hover:text-red-400 transition-all"
                      title="Remove from board"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
