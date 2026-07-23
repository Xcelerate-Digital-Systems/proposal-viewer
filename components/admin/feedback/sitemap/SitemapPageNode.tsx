'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, Figma, Image as ImageIcon, Plus, MessageSquareText, Eye } from 'lucide-react';
import type { FeedbackItem, FeedbackStatus } from '@/lib/supabase';
import { getFeedbackStatusDef } from '@/lib/feedback/status';

export interface SitemapNodeData extends Record<string, unknown> {
  item: FeedbackItem;
  commentCount: number;
  unresolvedCount: number;
  childCount: number;
  onNavigate?: (itemId: string) => void;
  onAddChild?: (parentId: string) => void;
  onUpdateStatus?: (itemId: string, status: FeedbackStatus) => void | Promise<void>;
}

const NODE_W = 240;
const NODE_H = 240;

function SitemapPageNodeComponent({ data, selected }: NodeProps) {
  const {
    item, commentCount, unresolvedCount, childCount,
    onNavigate, onAddChild, onUpdateStatus,
  } = data as SitemapNodeData;

  const status = getFeedbackStatusDef(item.status);
  const isWebpage = item.type === 'webpage';
  const isFigma = item.type === 'figma';
  const thumbnailSrc = item.image_url || item.ad_creative_url;

  return (
    <>
      {/* Handles — top source, bottom target for tree edges */}
      <Handle id="top" type="target" position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white !-top-1.5" />
      <Handle id="bottom" type="source" position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white !-bottom-1.5" />

      <div
        className={`relative bg-white rounded-2xl border shadow-sm transition-shadow ${
          selected ? 'border-teal ring-2 ring-teal/30' : 'border-edge hover:shadow-md'
        } cursor-pointer group`}
        style={{ width: NODE_W, minHeight: NODE_H }}
        onClick={(e) => { e.stopPropagation(); onNavigate?.(item.id); }}
      >
        <div className="px-4 py-4 flex flex-col gap-2.5">
          {/* Thumbnail */}
          <div className="relative h-[110px] overflow-hidden bg-surface rounded-lg border border-edge">
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailSrc} alt={item.title} loading="lazy" className="w-full h-full object-cover object-top" />
            ) : isWebpage && item.url ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-faint">
                <Globe size={20} />
                <span className="text-2xs font-mono truncate max-w-[180px]">{item.url}</span>
              </div>
            ) : isFigma ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-faint">
                <Figma size={20} />
                <span className="text-2xs truncate max-w-[180px]">{item.figma_frame_name || 'Figma frame'}</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-faint">
                <ImageIcon size={20} />
              </div>
            )}

            {/* Page path badge */}
            {item.page_path && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 text-2xs font-mono text-ink/70 border border-edge truncate max-w-[140px]">
                {item.page_path}
              </span>
            )}
          </div>

          {/* Type badge + title */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface text-2xs font-medium text-ink/70 border border-edge">
              {isWebpage ? <Globe size={10} /> : isFigma ? <Figma size={10} /> : <ImageIcon size={10} />}
              {isWebpage ? 'Page' : isFigma ? 'Figma' : 'Image'}
            </span>
            <h4 className="text-sm text-ink truncate leading-tight flex-1 min-w-0">
              {item.title}
            </h4>
          </div>

          {/* Status */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium w-fit ${status.bg} ${status.text}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdateStatus) {
                // Simplified — just show current status; full picker via detail view
              }
            }}
          >
            {status.icon}
            {status.label}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-edge">
            <div className="flex items-center gap-2 text-detail text-ink/60">
              <span className="flex items-center gap-1">
                <MessageSquareText size={11} className={commentCount > 0 && unresolvedCount === 0 ? 'text-emerald-600' : ''} />
                {commentCount === 0 ? '0' : unresolvedCount > 0 ? (
                  <span className="text-amber-600 font-semibold">{unresolvedCount}</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">{commentCount}</span>
                )}
              </span>
              {childCount > 0 && (
                <span className="text-2xs text-faint">{childCount} sub-page{childCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate?.(item.id); }}
              className="flex items-center gap-1 text-detail text-teal hover:text-teal-hover transition-colors"
            >
              <Eye size={11} />
              View
            </button>
          </div>
        </div>

        {/* Add child button — appears on hover at bottom */}
        {onAddChild && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-teal text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-teal-hover"
            title="Add sub-page"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
    </>
  );
}

const SitemapPageNode = memo(SitemapPageNodeComponent);
SitemapPageNode.displayName = 'SitemapPageNode';
export default SitemapPageNode;
