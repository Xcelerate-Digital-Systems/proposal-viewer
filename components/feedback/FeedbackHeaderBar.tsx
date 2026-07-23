'use client';

import { useMemo } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  MessageSquare, MousePointer2, ArrowRight, Pencil,
} from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';
import { generateBrandPalette } from '@/lib/branding';
import VersionPicker from '@/components/feedback/VersionPicker';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';
import ClientStatusControl from '@/components/feedback/ClientStatusControl';
import Tooltip from '@/components/ui/Tooltip';
import type { FeedbackProject, FeedbackItem, FeedbackStatus } from '@/lib/supabase';
import type { CompanyBranding } from '@/hooks/useProposal';
import type { VersionView } from '@/lib/feedback/versions';

export type ReviewMode = 'comment' | 'browse';

interface FeedbackHeaderBarProps {
  // Project + selection
  project: FeedbackProject;
  items: FeedbackItem[];
  selectedItem: FeedbackItem | null;
  filteredItems: FeedbackItem[];

  // Filters & nav
  typeFilter: string | null;
  stripTypes: string[];
  stripVariant: 'admin' | 'branded';
  currentIdx: number;
  singleItemOnly: boolean;
  onFilterChange: (type: string | null) => void;
  onGoToItem: (idx: number) => void;

  // Branding
  branding?: CompanyBranding;
  headerBranded: boolean;
  hasBranding: boolean;
  accent: string;
  sidebarText: string;
  bgSecondary: string;

  // Back action
  backAction?: { label: string; onClick: () => void };

  // Versions
  versions?: VersionView[];
  activeVersionId: string | null;
  onVersionChange?: (id: string | null) => void;
  onAddVersion?: () => void;
  onEditVersion?: (versionId: string | null) => void;
  onCompareVersions?: () => void;

  // Per-item status (client-facing picker shown when handler provided)
  onUpdateItemStatus?: (itemId: string, status: FeedbackStatus) => Promise<void> | void;

  // Slot for admin actions (e.g. share button)
  renderHeaderActions?: (item: FeedbackItem | null) => React.ReactNode;

  // Review controls (client only)
  reviewMode?: ReviewMode;
  onReviewModeChange?: (mode: ReviewMode) => void;
  reviewerName?: string;
  reviewerAvatarUrl?: string | null;
  reviewSubmitted?: boolean;
  onOpenFinishModal: () => void;
  hasFinishHandler: boolean;

  // Progress tracking
  /** Number of items that have at least one comment or an explicit status set */
  reviewedCount?: number;
}

/**
 * Top chrome strip for FeedbackDetailView. Houses the back link, brand
 * logo / project title, type filter, prev/next nav, version picker,
 * client status picker, header-action slot, and the client review
 * controls (Comment/Browse, avatar, Finish).
 */
export default function FeedbackHeaderBar({
  project,
  items,
  selectedItem,
  filteredItems,
  typeFilter,
  stripTypes,
  stripVariant,
  currentIdx,
  singleItemOnly,
  onFilterChange,
  onGoToItem,
  branding,
  headerBranded,
  hasBranding,
  accent,
  sidebarText,
  bgSecondary,
  backAction,
  versions,
  activeVersionId,
  onVersionChange,
  onAddVersion,
  onEditVersion,
  onCompareVersions,
  onUpdateItemStatus,
  renderHeaderActions,
  reviewMode,
  onReviewModeChange,
  reviewerName,
  reviewerAvatarUrl,
  reviewSubmitted,
  onOpenFinishModal,
  hasFinishHandler,
  reviewedCount,
}: FeedbackHeaderBarProps) {
  const palette = useMemo(() =>
    branding ? generateBrandPalette(branding.accent_color, branding.bg_primary, branding.bg_secondary, branding.sidebar_text_color, branding.accept_text_color, branding.bg_divider, branding.sidebar_inactive_text_color) : null,
    [branding?.accent_color, branding?.bg_primary, branding?.bg_secondary, branding?.sidebar_text_color, branding?.accept_text_color, branding?.bg_divider, branding?.sidebar_inactive_text_color]
  );

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 shrink-0 ${
        headerBranded ? '' : 'bg-white shadow-divider'
      }`}
      style={
        headerBranded
          ? { backgroundColor: bgSecondary, borderBottom: `2px solid ${branding?.accent_color || accent}` }
          : undefined
      }
    >
      {/* Back + branding + title */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {backAction ? (
          <button
            onClick={backAction.onClick}
            className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ${
              headerBranded ? '' : 'bg-surface text-prose hover:text-ink'
            }`}
            style={headerBranded ? { border: `1px solid ${palette?.border ?? `${sidebarText}25`}`, color: sidebarText } : undefined}
            aria-label={backAction.label}
            title={backAction.label}
          >
            <ArrowLeft size={14} />
          </button>
        ) : null}

        {hasBranding && branding?.logo_url && (
          <>
            {backAction && (
              <span
                className={`h-4 w-px shrink-0 ${headerBranded ? '' : 'bg-surface'}`}
                style={headerBranded ? { backgroundColor: palette?.border ?? `${sidebarText}25` } : undefined}
              />
            )}
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="h-5 w-auto max-w-[100px] object-contain"
            />
          </>
        )}
        {hasBranding && !branding?.logo_url && branding?.name && (
          <>
            {backAction && (
              <span
                className={`h-4 w-px shrink-0 ${headerBranded ? '' : 'bg-surface'}`}
                style={headerBranded ? { backgroundColor: palette?.border ?? `${sidebarText}25` } : undefined}
              />
            )}
            <span
              className="text-sm font-semibold"
              style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}
            >
              {branding.name}
            </span>
          </>
        )}

        <span
          className={`h-4 w-px ${headerBranded ? '' : 'bg-surface'}`}
          style={headerBranded ? { backgroundColor: palette?.border ?? `${sidebarText}25` } : undefined}
        />
        <span
          className={`text-base font-semibold tracking-tight truncate max-w-[220px] ${
            headerBranded ? '' : 'text-ink'
          }`}
          style={headerBranded ? { color: sidebarText } : undefined}
          title={project.title}
        >
          {project.title}
        </span>
        {(project.client_company || project.client_name) && (
          <span
            className={`text-xs truncate hidden xl:inline ${headerBranded ? '' : 'text-faint'}`}
            style={headerBranded ? { color: palette?.mutedText ?? `${sidebarText}80` } : undefined}
            title={project.client_company || project.client_name || undefined}
          >
            · {project.client_company || project.client_name}
          </span>
        )}
      </div>

      {/* Type filter */}
      {!singleItemOnly && stripTypes.length > 1 && (
        <>
          <div
            className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-surface'}`}
            style={headerBranded ? { backgroundColor: palette?.border ?? `${sidebarText}25` } : undefined}
          />
          <div className="shrink-0">
            <TypeFilterTabs
              items={items}
              availableTypes={stripTypes}
              typeFilter={typeFilter}
              onFilterChange={onFilterChange}
              variant={stripVariant}
              sidebarTextColor={headerBranded ? sidebarText : undefined}
              showCounts={false}
            />
          </div>
        </>
      )}

      {/* Prev/next nav */}
      {!singleItemOnly && filteredItems.length > 1 && (
        <>
          <div
            className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-surface'}`}
            style={headerBranded ? { backgroundColor: palette?.border ?? `${sidebarText}25` } : undefined}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onGoToItem(currentIdx - 1)}
              disabled={currentIdx <= 0}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ${
                headerBranded ? '' : 'bg-surface text-prose hover:bg-surface'
              }`}
              style={
                headerBranded
                  ? { border: `1px solid ${palette?.border ?? `${sidebarText}25`}`, color: sidebarText }
                  : undefined
              }
              aria-label="Previous item"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className={`text-xs tabular-nums whitespace-nowrap ${
                headerBranded ? '' : 'text-faint'
              }`}
              style={headerBranded ? { color: palette?.mutedText ?? `${sidebarText}80` } : undefined}
            >
              {currentIdx + 1}/{filteredItems.length}
            </span>
            <button
              onClick={() => onGoToItem(currentIdx + 1)}
              disabled={currentIdx >= filteredItems.length - 1}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ${
                headerBranded ? '' : 'bg-surface text-prose hover:bg-surface'
              }`}
              style={
                headerBranded
                  ? { border: `1px solid ${palette?.border ?? `${sidebarText}25`}`, color: sidebarText }
                  : undefined
              }
              aria-label="Next item"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Progress indicator (client review mode) */}
      {reviewedCount !== undefined && filteredItems.length > 1 && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="relative w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: palette?.accentSurface ?? `${sidebarText}15` }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((reviewedCount / filteredItems.length) * 100)}%`,
                  backgroundColor: branding?.accent_color || '#017C87',
                }}
              />
            </div>
            <span
              className="text-detail tabular-nums whitespace-nowrap"
              style={headerBranded ? { color: palette?.mutedText ?? `${sidebarText}80` } : undefined}
            >
              {reviewedCount}/{filteredItems.length} reviewed
            </span>
          </div>
        </div>
      )}

      {/* Trailing controls */}
      <div className="flex items-center gap-2 shrink-0">
        {versions && versions.length > 0 && onVersionChange && (
          <div className="shrink-0 flex items-center gap-0.5 bg-surface rounded-full p-0.5">
            <VersionPicker
              versions={versions}
              activeVersionId={activeVersionId}
              onChange={onVersionChange}
              onAddVersion={onAddVersion}
              onEditVersion={onEditVersion}
              onCompare={onCompareVersions}
              itemStatus={selectedItem?.status}
              compact
            />
            {onEditVersion && (
              <button
                type="button"
                onClick={() => onEditVersion(activeVersionId)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-detail font-medium text-prose hover:bg-surface hover:text-ink transition-colors"
                title="Edit this version's content"
              >
                <Pencil size={11} />
                Edit
              </button>
            )}
          </div>
        )}

        {onUpdateItemStatus && selectedItem && (
          <div className="shrink-0">
            <ClientStatusControl
              itemId={selectedItem.id}
              status={selectedItem.status}
              onChange={onUpdateItemStatus}
              branded={headerBranded}
              sidebarText={sidebarText}
            />
          </div>
        )}

        {renderHeaderActions && (
          <div className="flex items-center gap-2 shrink-0">{renderHeaderActions(selectedItem)}</div>
        )}

        {/* Review controls (Comment/Browse pill) — labeled buttons */}
        {onReviewModeChange && reviewMode && (
          <div
            className="flex items-center rounded-full p-0.5 shrink-0"
            style={{ backgroundColor: palette?.accentSurface ?? `${sidebarText}15` }}
          >
            <Tooltip content="Click anywhere on content to pin feedback" placement="bottom">
              <button
                type="button"
                onClick={() => onReviewModeChange('comment')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
                style={
                  reviewMode === 'comment'
                    ? { backgroundColor: palette?.borderSubtle ?? `${sidebarText}26`, color: sidebarText }
                    : { color: palette?.mutedText ?? `${sidebarText}99` }
                }
              >
                <MessageSquare size={12} />
                Comment
              </button>
            </Tooltip>
            <Tooltip content="Navigate content without leaving feedback" placement="bottom">
              <button
                type="button"
                onClick={() => onReviewModeChange('browse')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
                style={
                  reviewMode === 'browse'
                    ? { backgroundColor: palette?.borderSubtle ?? `${sidebarText}26`, color: sidebarText }
                    : { color: palette?.mutedText ?? `${sidebarText}99` }
                }
              >
                <MousePointer2 size={12} />
                Browse
              </button>
            </Tooltip>
          </div>
        )}

        {reviewerName !== undefined && (
          reviewerAvatarUrl ? (
            <img
              src={reviewerAvatarUrl}
              alt={reviewerName || 'Reviewer'}
              className="w-7 h-7 rounded-full object-cover shrink-0"
              title={reviewerName || 'Reviewer'}
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: branding?.accent_color || '#017C87' }}
              title={reviewerName || 'Reviewer'}
            >
              {(reviewerName.trim()[0] ?? 'R').toUpperCase()}
            </div>
          )
        )}

        {hasFinishHandler &&
          (reviewSubmitted ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
              Review submitted
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenFinishModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold hover:brightness-110 transition-all shadow-sm shrink-0 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
              style={{ backgroundColor: branding?.accent_color || '#017C87' }}
            >
              Finish reviewing
              <ArrowRight size={12} />
            </button>
          ))}
      </div>
    </div>
  );
}
