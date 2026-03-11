// components/viewer/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, XCircle, PenLine } from 'lucide-react';
import { PageNameEntry } from '@/lib/supabase';
import { CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';

interface SidebarProps {
  numPages:          number;
  currentPage:       number;
  pageEntries:       PageNameEntry[];
  getPageName:       (page: number) => string;
  onPageSelect:      (page: number) => void;
  branding:          CompanyBranding;
  mobileOpen?:       boolean;
  onMobileClose?:    () => void;
  // Optional proposal-specific props — when omitted, bottom actions are hidden
  accepted?:              boolean;
  declined?:              boolean;
  revisionRequested?:     boolean;
  onAcceptClick?:         () => void;
  onDeclineClick?:        () => void;
  onRevisionClick?:       () => void;
  showComments?:          boolean;
  onToggleComments?:      () => void;
  commentCount?:          number;
  acceptButtonText?:      string;
}

interface NavItem {
  pageNum:  number;
  name:     string;
  isGroup:  boolean;
  children: { pageNum: number; name: string }[];
}

// pageNum always mirrors the viewer's currentPage (1-based pageUrls index).
// Groups use a negative key so they never collide with real page numbers.
function buildNavTree(entries: PageNameEntry[]): NavItem[] {
  const tree: NavItem[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isGroup = entry.type === 'group';
    const rawPageNum = i + 1;

    if (entry.indent > 0 && tree.length > 0) {
      if (!isGroup) {
        tree[tree.length - 1].children.push({ pageNum: rawPageNum, name: entry.name });
      }
    } else {
      tree.push({ pageNum: isGroup ? -rawPageNum : rawPageNum, name: entry.name, isGroup, children: [] });
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
  branding,
  mobileOpen = false,
  onMobileClose,
  accepted,
  declined,
  revisionRequested,
  onAcceptClick,
  onDeclineClick,
  onRevisionClick,
  showComments,
  onToggleComments,
  commentCount,
  acceptButtonText,
}: SidebarProps) {
  const navTree = buildNavTree(pageEntries);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const accent      = branding.accent_color        || '#ff6700';
  const bgSecondary = branding.bg_secondary        || '#141414';
  const border      = deriveBorderColor(bgSecondary);
  const sidebarText = branding.sidebar_text_color  || '#ffffff';
  const acceptText  = branding.accept_text_color   || '#ffffff';
  const label       = acceptButtonText             || 'Approve & Continue';

  // Show bottom actions only when the accept handler is wired up (proposals only)
  const showActions = onAcceptClick !== undefined && onToggleComments !== undefined;

  // Terminal state: prospect has done something — don't show action buttons
  const terminalState = accepted || declined || revisionRequested;

  // Auto-expand the group containing the current page
  useEffect(() => {
    for (const item of navTree) {
      if (item.children.length > 0) {
        if (item.isGroup) {
          if (item.children.some((c) => c.pageNum === currentPage)) {
            setExpandedGroup(item.pageNum);
            return;
          }
        } else {
          if (item.pageNum === currentPage || item.children.some((c) => c.pageNum === currentPage)) {
            setExpandedGroup(item.pageNum);
            return;
          }
        }
      }
    }
    setExpandedGroup(null);
  }, [currentPage, numPages, pageEntries.length]);

  const handleParentClick = (item: NavItem) => {
    if (item.isGroup) {
      const willExpand = expandedGroup !== item.pageNum;
      setExpandedGroup(willExpand ? item.pageNum : null);
      if (willExpand && item.children.length > 0) onPageSelect(item.children[0].pageNum);
      onMobileClose?.();
    } else {
      onPageSelect(item.pageNum);
      onMobileClose?.();
    }
  };

  const handleChildClick = (pageNum: number) => {
    onPageSelect(pageNum);
    onMobileClose?.();
  };

  const isChildActive = (item: NavItem) => item.children.some((c) => c.pageNum === currentPage);

  const sidebarContent = (
    <>
      {/* Logo / company name */}
      <div className="px-5 py-4 shrink-0 border-b flex items-center justify-between" style={{ borderColor: border }}>
        <div className="min-w-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-6 max-w-[180px] object-contain" />
          ) : branding.name ? (
            <span
              className="text-sm font-semibold truncate"
              style={{ color: sidebarText, fontFamily: fontFamily(branding.font_sidebar) }}
            >
              {branding.name}
            </span>
          ) : null}
        </div>
      </div>

      {/* Nav tree */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {navTree.map((item) => {
          const hasChildren   = item.children.length > 0;
          const isExpanded    = expandedGroup === item.pageNum;
          const isParentActive = item.pageNum === currentPage;
          const childActive   = isChildActive(item);
          const groupActive   = isParentActive || childActive;

          return (
            <div key={item.pageNum}>
              <button
                onClick={() => handleParentClick(item)}
                disabled={item.isGroup && !hasChildren}
                className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: groupActive && !item.isGroup ? `${accent}18` : 'transparent',
                  color: groupActive
                    ? sidebarText
                    : `${sidebarText}99`,
                  fontFamily: fontFamily(branding.font_sidebar),
                  fontWeight: isParentActive
                    ? Math.min(Number(branding.font_sidebar_weight || 400) + 200, 900)
                    : childActive && !isExpanded
                    ? Math.min(Number(branding.font_sidebar_weight || 400) + 100, 900)
                    : Number(branding.font_sidebar_weight || 400),
                }}
              >
                <span className="truncate">{item.name}</span>

                {hasChildren && (
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full ml-2 transition-opacity"
                    style={{
                      backgroundColor: groupActive ? accent : `${sidebarText}40`,
                    }}
                  />
                )}
              </button>

              {hasChildren && isExpanded && (
                <div className="ml-5 mr-3 mb-1" style={{ borderLeft: `2px solid ${accent}40` }}>
                  {item.children.map((child) => (
                    <button
                      key={child.pageNum}
                      onClick={() => handleChildClick(child.pageNum)}
                      className="w-full text-left pl-4 pr-3 py-2 text-sm transition-colors truncate"
                      style={{
                        color: currentPage === child.pageNum ? sidebarText : `${sidebarText}99`,
                        fontFamily: fontFamily(branding.font_sidebar),
                        fontWeight: currentPage === child.pageNum
                          ? Math.min(Number(branding.font_sidebar_weight || 400) + 200, 900)
                          : Number(branding.font_sidebar_weight || 400),
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

      {/* Bottom actions — proposals only */}
      {showActions && (
        <div className="p-3 space-y-2 border-t" style={{ borderColor: border }}>
          {/* ── Terminal state badges ── */}
          {accepted && (
            <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
              <CheckCircle2 size={15} />
              Approved
            </div>
          )}

          {declined && (
            <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-red-900/20 text-red-400 border border-red-800/30">
              <XCircle size={15} />
              Declined
            </div>
          )}

          {revisionRequested && (
            <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-amber-900/20 text-amber-400 border border-amber-800/30">
              <PenLine size={15} />
              Changes Requested
            </div>
          )}

          {/* ── Action buttons (hidden after any terminal action) ── */}
          {!terminalState && (
            <>
              {/* Primary: Approve */}
              <button
                onClick={onAcceptClick}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent, color: acceptText }}
              >
                <CheckCircle2 size={15} />
                {label}
              </button>

              {/* Secondary: Request Changes + Decline */}
              <div className="space-y-2">
                <button
                  onClick={onRevisionClick}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border hover:bg-amber-900/10"
                  style={{ borderColor: '#f59e0b60', color: '#f59e0b' }}
                >
                  <PenLine size={13} />
                  Request Changes
                </button>
                <button
                  onClick={onDeclineClick}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border hover:bg-red-900/10"
                  style={{ borderColor: '#ef444460', color: '#ef4444' }}
                >
                  <XCircle size={13} />
                  Decline
                </button>
              </div>
            </>
          )}

          {/* Comments — always visible */}
          <button
            onClick={onToggleComments}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border"
            style={showComments
              ? { backgroundColor: accent, borderColor: accent, color: acceptText }
              : { backgroundColor: 'transparent', borderColor: `${sidebarText}40`, color: sidebarText }
            }
          >
            <MessageSquare size={15} />
            Comment
            {(commentCount ?? 0) > 0 && (
              <span
                className="text-xs w-5 h-5 rounded-full flex items-center justify-center"
                style={showComments
                  ? { backgroundColor: `${acceptText}30`, color: acceptText }
                  : { backgroundColor: `${sidebarText}20`, color: sidebarText }
                }
              >
                {commentCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex w-64 flex-col shrink-0 border-r"
        style={{ backgroundColor: bgSecondary, borderColor: border }}
      >
        {sidebarContent}
      </div>

      {/* Mobile slide-over */}
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