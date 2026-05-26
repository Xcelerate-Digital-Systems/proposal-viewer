'use client';

import {
  ArrowLeft, ChevronLeft, ChevronRight,
  MessageSquare, MousePointer2, ArrowRight, Pencil,
} from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';
import VersionPicker from '@/components/feedback/VersionPicker';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';
import ClientStatusControl from '@/components/feedback/ClientStatusControl';
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

  // Per-item status (client-facing picker shown when handler provided)
  onUpdateItemStatus?: (itemId: string, status: FeedbackStatus) => Promise<void> | void;

  // Slot for admin actions (e.g. share button)
  renderHeaderActions?: (item: FeedbackItem | null) => React.ReactNode;

  // Review controls (client only)
  reviewMode?: ReviewMode;
  onReviewModeChange?: (mode: ReviewMode) => void;
  reviewerName?: string;
  reviewSubmitted?: boolean;
  onOpenFinishModal: () => void;
  hasFinishHandler: boolean;
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
  onUpdateItemStatus,
  renderHeaderActions,
  reviewMode,
  onReviewModeChange,
  reviewerName,
  reviewSubmitted,
  onOpenFinishModal,
  hasFinishHandler,
}: FeedbackHeaderBarProps) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 shrink-0 ${
        headerBranded ? '' : 'bg-white shadow-[0_1px_0_rgba(20,20,40,0.05)]'
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
            className={`flex items-center gap-1.5 text-sm transition-colors min-w-0 ${
              headerBranded ? '' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={headerBranded ? { color: `${sidebarText}99` } : undefined}
          >
            <ArrowLeft size={14} className="shrink-0" />
            <span className="font-medium truncate max-w-[180px]">{backAction.label}</span>
          </button>
        ) : null}

        {hasBranding && branding?.logo_url && (
          <>
            {backAction && <span style={{ color: `${sidebarText}40` }}>·</span>}
            <img
              src={branding.logo_url}
              alt={branding.name}
              className="h-5 w-auto max-w-[100px] object-contain"
            />
          </>
        )}
        {hasBranding && !branding?.logo_url && branding?.name && (
          <>
            {backAction && <span style={{ color: `${sidebarText}40` }}>·</span>}
            <span
              className="text-sm font-semibold"
              style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}
            >
              {branding.name}
            </span>
          </>
        )}

        <span
          className={`h-4 w-px ${headerBranded ? '' : 'bg-gray-100'}`}
          style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
        />
        <span
          className={`text-[15px] font-semibold tracking-tight truncate max-w-[220px] ${
            headerBranded ? '' : 'text-ink'
          }`}
          style={headerBranded ? { color: sidebarText } : undefined}
        >
          {project.title}
        </span>
        {(project.client_company || project.client_name) && (
          <span
            className={`text-xs truncate hidden xl:inline ${headerBranded ? '' : 'text-gray-400'}`}
            style={headerBranded ? { color: `${sidebarText}80` } : undefined}
          >
            · {project.client_company || project.client_name}
          </span>
        )}
      </div>

      {/* Type filter */}
      {!singleItemOnly && stripTypes.length > 1 && (
        <>
          <div
            className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-gray-100'}`}
            style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
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
            className={`w-px h-6 shrink-0 ${headerBranded ? '' : 'bg-gray-100'}`}
            style={headerBranded ? { backgroundColor: `${sidebarText}25` } : undefined}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onGoToItem(currentIdx - 1)}
              disabled={currentIdx <= 0}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                headerBranded ? '' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              style={
                headerBranded
                  ? { border: `1px solid ${sidebarText}25`, color: sidebarText }
                  : undefined
              }
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <span
              className={`text-xs tabular-nums whitespace-nowrap ${
                headerBranded ? '' : 'text-gray-400'
              }`}
              style={headerBranded ? { color: `${sidebarText}80` } : undefined}
            >
              {currentIdx + 1} of {filteredItems.length}
            </span>
            <button
              onClick={() => onGoToItem(currentIdx + 1)}
              disabled={currentIdx >= filteredItems.length - 1}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                headerBranded ? '' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              style={
                headerBranded
                  ? { border: `1px solid ${sidebarText}25`, color: sidebarText }
                  : undefined
              }
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Trailing controls */}
      <div className="flex items-center gap-2 shrink-0">
        {versions && versions.length > 0 && onVersionChange && (
          <div className="shrink-0 flex items-center gap-1">
            <VersionPicker
              versions={versions}
              activeVersionId={activeVersionId}
              onChange={onVersionChange}
              onAddVersion={onAddVersion}
              onEditVersion={onEditVersion}
              compact
            />
            {onEditVersion && (
              <button
                type="button"
                onClick={() => onEditVersion(activeVersionId)}
                className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-ink transition-colors"
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

        {/* Review controls (Comment/Browse pill) */}
        {onReviewModeChange && reviewMode && (
          <div
            className="flex items-center rounded-full p-0.5 shrink-0"
            style={{ backgroundColor: `${sidebarText}15` }}
          >
            <button
              type="button"
              onClick={() => onReviewModeChange('comment')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors"
              style={
                reviewMode === 'comment'
                  ? { backgroundColor: `${sidebarText}26`, color: sidebarText }
                  : { color: `${sidebarText}99` }
              }
            >
              <MessageSquare size={12} />
              Comment
            </button>
            <button
              type="button"
              onClick={() => onReviewModeChange('browse')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold transition-colors"
              style={
                reviewMode === 'browse'
                  ? { backgroundColor: `${sidebarText}26`, color: sidebarText }
                  : { color: `${sidebarText}99` }
              }
            >
              <MousePointer2 size={12} />
              Browse
            </button>
          </div>
        )}

        {reviewerName !== undefined && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: branding?.accent_color || '#017C87' }}
            title={reviewerName || 'Reviewer'}
          >
            {(reviewerName.trim()[0] ?? 'R').toUpperCase()}
          </div>
        )}

        {hasFinishHandler &&
          (reviewSubmitted ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-semibold shrink-0">
              Review submitted
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenFinishModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[12px] font-semibold hover:brightness-110 transition-all shadow-sm shrink-0"
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
