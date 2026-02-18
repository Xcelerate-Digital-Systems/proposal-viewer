// components/viewer/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, ChevronRight } from 'lucide-react';
import { PageNameEntry } from '@/lib/supabase';

interface SidebarProps {
  numPages: number;
  currentPage: number;
  pageEntries: PageNameEntry[];
  getPageName: (page: number) => string;
  onPageSelect: (page: number) => void;
  accepted: boolean;
  onAcceptClick: () => void;
  showComments: boolean;
  onToggleComments: () => void;
  commentCount: number;
}

/**
 * Build a tree structure from flat PageNameEntry[].
 * A page with indent=1 is nested under the most recent indent=0 page above it.
 */
interface NavItem {
  pageNum: number;
  name: string;
  children: { pageNum: number; name: string }[];
}

function buildNavTree(entries: PageNameEntry[]): NavItem[] {
  const tree: NavItem[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.indent > 0 && tree.length > 0) {
      tree[tree.length - 1].children.push({ pageNum: i + 1, name: entry.name });
    } else {
      tree.push({ pageNum: i + 1, name: entry.name, children: [] });
    }
  }

  return tree;
}

export default function Sidebar({
  numPages,
  currentPage,
  pageEntries,
  getPageName,
  onPageSelect,
  accepted,
  onAcceptClick,
  showComments,
  onToggleComments,
  commentCount,
}: SidebarProps) {
  const navTree = buildNavTree(pageEntries.slice(0, numPages));

  // Track which parent group is expanded — null means all collapsed (accordion style)
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // Auto-expand the parent group that contains the current page
  useEffect(() => {
    for (const item of navTree) {
      if (item.children.length > 0) {
        if (item.pageNum === currentPage || item.children.some((c) => c.pageNum === currentPage)) {
          setExpandedGroup(item.pageNum);
          return;
        }
      }
    }
  }, [currentPage, numPages, pageEntries.length]);

  const toggleGroup = (pageNum: number) => {
    setExpandedGroup((prev) => (prev === pageNum ? null : pageNum));
  };

  const handleParentClick = (item: NavItem) => {
    if (item.children.length > 0) {
      setExpandedGroup((prev) => (prev === item.pageNum ? null : item.pageNum));
    }
    onPageSelect(item.pageNum);
  };

  const isChildActive = (item: NavItem) =>
    item.children.some((c) => c.pageNum === currentPage);

  return (
    <div className="w-64 bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#2a2a2a] shrink-0">
        <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-6" />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto tab-sidebar pt-2">
        {navTree.map((item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = expandedGroup === item.pageNum;
          const isParentActive = currentPage === item.pageNum;
          const childActive = isChildActive(item);

          return (
            <div key={item.pageNum}>
              {/* Parent / top-level item */}
              <div className="flex items-center">
                {hasChildren && (
                  <button
                    onClick={() => toggleGroup(item.pageNum)}
                    className="pl-3 pr-1 py-2.5 text-[#555] hover:text-[#999] transition-colors"
                  >
                    <ChevronRight
                      size={13}
                      className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>
                )}
                <button
                  onClick={() => handleParentClick(item)}
                  className={`flex-1 text-left py-2.5 text-sm transition-colors truncate ${
                    hasChildren ? 'pr-5' : 'px-5'
                  } ${
                    isParentActive
                      ? 'text-white font-semibold'
                      : childActive && !isExpanded
                      ? 'text-[#ccc] font-medium'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  {item.name}
                </button>
              </div>

              {/* Children */}
              {hasChildren && isExpanded && (
                <div>
                  {item.children.map((child) => (
                    <button
                      key={child.pageNum}
                      onClick={() => onPageSelect(child.pageNum)}
                      className={`w-full text-left pl-10 pr-5 py-2 text-sm transition-colors truncate ${
                        currentPage === child.pageNum
                          ? 'text-white font-semibold'
                          : 'text-[#666] hover:text-white'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
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
                showComments
                  ? 'bg-[#ff6700]/20 text-[#ff6700]'
                  : 'bg-[#2a2a2a] text-[#888]'
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