'use client';

import { CheckCircle2, MessageSquare } from 'lucide-react';

interface SidebarProps {
  numPages: number;
  currentPage: number;
  getPageName: (page: number) => string;
  onPageSelect: (page: number) => void;
  accepted: boolean;
  onAcceptClick: () => void;
  showComments: boolean;
  onToggleComments: () => void;
  commentCount: number;
}

export default function Sidebar({
  numPages,
  currentPage,
  getPageName,
  onPageSelect,
  accepted,
  onAcceptClick,
  showComments,
  onToggleComments,
  commentCount,
}: SidebarProps) {
  return (
    <div className="w-64 bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto tab-sidebar pt-2">
        {numPages > 0 &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageSelect(pageNum)}
              className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${
                currentPage === pageNum
                  ? 'text-white font-semibold'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              {getPageName(pageNum)}
            </button>
          ))}
      </div>

      <div className="border-t border-[#2a2a2a] p-3 space-y-2">
        {accepted ? (
          <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
            <CheckCircle2 size={15} />
            Accepted
          </div>
        ) : (
          <button
            onClick={onAcceptClick}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
          >
            <CheckCircle2 size={15} />
            Accept Proposal
          </button>
        )}
        <button
          onClick={onToggleComments}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
            showComments
              ? 'bg-[#ff6700]/10 border-[#ff6700]/30 text-[#ff6700]'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444]'
          }`}
        >
          <MessageSquare size={15} />
          Comments
          {commentCount > 0 && (
            <span
              className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                showComments ? 'bg-[#ff6700]/20 text-[#ff6700]' : 'bg-[#ff6700] text-white'
              }`}
            >
              {commentCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}