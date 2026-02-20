// components/viewer/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, Building2, X } from 'lucide-react';
import { PageNameEntry } from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';

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
  branding: CompanyBranding;
  acceptButtonText?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

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
  branding,
  acceptButtonText,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const navTree = buildNavTree(pageEntries.slice(0, numPages));
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const accent = branding.accent_color || '#ff6700';
  const bgSecondary = branding.bg_secondary || '#141414';
  const border = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color || '#ffffff';
  const acceptText = branding.accept_text_color || '#ffffff';

  const label = acceptButtonText || 'Approve & Continue';

  // Auto-expand the group containing the current page, collapse when leaving
  useEffect(() => {
    for (const item of navTree) {
      if (item.children.length > 0) {
        if (item.pageNum === currentPage || item.children.some((c) => c.pageNum === currentPage)) {
          setExpandedGroup(item.pageNum);
          return;
        }
      }
    }
    // Current page is not inside any parent group — collapse all
    setExpandedGroup(null);
  }, [currentPage, numPages, pageEntries.length]);

  const handleParentClick = (item: NavItem) => {
    onPageSelect(item.pageNum);
    onMobileClose?.();
  };

  const handleChildClick = (pageNum: number) => {
    onPageSelect(pageNum);
    onMobileClose?.();
  };

  const isChildActive = (item: NavItem) =>
    item.children.some((c) => c.pageNum === currentPage);

  const sidebarContent = (
    <>
      {/* Company logo / name */}
      <div className="px-5 py-4 shrink-0 border-b flex items-center justify-between" style={{ borderColor: border }}>
        <div className="min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-6 max-w-[180px] object-contain" />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#555]" />
              <span className="text-sm font-medium truncate" style={{ color: sidebarText }}>{branding.name}</span>
            </div>
          ) : (
            <img src="/logo-white.svg" alt="Logo" className="h-6" />
          )}
        </div>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 text-[#666] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto tab-sidebar pt-2">
        {navTree.map((item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = expandedGroup === item.pageNum;
          const isParentActive = currentPage === item.pageNum;
          const childActive = isChildActive(item);
          const groupActive = isParentActive || childActive;

          return (
            <div key={item.pageNum}>
              {/* Parent tab */}
              <button
                onClick={() => handleParentClick(item)}
                className="w-full text-left flex items-center justify-between transition-colors truncate relative"
                style={{ padding: '10px 20px' }}
              >
                <span
                  className={`truncate text-sm ${
                    isParentActive
                      ? 'font-semibold'
                      : childActive && !isExpanded
                      ? 'font-medium'
                      : ''
                  }`}
                  style={{
                    color: isParentActive
                      ? sidebarText
                      : childActive && !isExpanded
                      ? `${sidebarText}cc`
                      : hasChildren
                      ? `${sidebarText}aa`
                      : `${sidebarText}88`,
                  }}
                >
                  {item.name}
                </span>

                {/* Small accent dot on right for parents with children */}
                {hasChildren && (
                  <span
                    className="shrink-0 ml-2 w-1 h-1 rounded-full transition-opacity"
                    style={{
                      backgroundColor: groupActive ? accent : '#555',
                      opacity: isExpanded ? 1 : 0.7,
                    }}
                  />
                )}

                {/* Accent underline for parent items with children */}
                {hasChildren && (
                  <span
                    className="absolute bottom-0 left-5 right-5 h-px transition-opacity"
                    style={{
                      backgroundColor: groupActive ? accent : '#333',
                      opacity: isExpanded ? 0.4 : 0.15,
                    }}
                  />
                )}
              </button>

              {/* Children — shown with accent left border */}
              {hasChildren && isExpanded && (
                <div
                  className="ml-5 mr-3 mb-1"
                  style={{ borderLeft: `2px solid ${accent}40` }}
                >
                  {item.children.map((child) => (
                    <button
                      key={child.pageNum}
                      onClick={() => handleChildClick(child.pageNum)}
                      className={`w-full text-left pl-4 pr-3 py-2 text-sm transition-colors truncate ${
                        currentPage === child.pageNum
                          ? 'font-semibold'
                          : ''
                      }`}
                      style={{
                        color: currentPage === child.pageNum
                          ? sidebarText
                          : `${sidebarText}66`,
                      }}
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
      <div className="p-3 space-y-2 border-t" style={{ borderColor: border }}>
        {accepted ? (
          <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
            <CheckCircle2 size={15} />
            Approved
          </div>
        ) : (
          <button
            onClick={onAcceptClick}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: acceptText }}
          >
            <CheckCircle2 size={15} />
            {label}
          </button>
        )}
        <button
          onClick={onToggleComments}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border"
          style={showComments
            ? { backgroundColor: `${accent}18`, borderColor: `${accent}40`, color: accent }
            : { backgroundColor: `${bgSecondary}`, borderColor: border, color: '#888' }
          }
        >
          <MessageSquare size={15} />
          Comments
          {commentCount > 0 && (
            <span
              className="text-xs w-5 h-5 rounded-full flex items-center justify-center"
              style={showComments
                ? { backgroundColor: `${accent}30`, color: accent }
                : { backgroundColor: border, color: '#888' }
              }
            >
              {commentCount}
            </span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div
        className="hidden lg:flex w-64 flex-col shrink-0 border-r"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide-over drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            style={{ backgroundColor: bgSecondary }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}