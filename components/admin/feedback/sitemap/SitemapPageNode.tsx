'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, Figma, Image as ImageIcon, Plus, MessageSquareText } from 'lucide-react';
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

export const NODE_W = 180;
export const NODE_H = 160;

function SitemapPageNodeComponent({ data, selected }: NodeProps) {
  const {
    item, commentCount, unresolvedCount, childCount,
    onNavigate, onAddChild,
  } = data as SitemapNodeData;

  const status = getFeedbackStatusDef(item.status);
  const isWebpage = item.type === 'webpage';
  const isFigma = item.type === 'figma';
  const hasBoth = isWebpage && !!item.figma_file_key;
  const thumbnailSrc = item.image_url || item.ad_creative_url;

  return (
    <>
      <Handle id="top" type="target" position={Position.Top}
        className="!w-2 !h-2 !bg-slate-400 !border-2 !border-white !-top-1" />
      <Handle id="bottom" type="source" position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !border-2 !border-white !-bottom-1" />

      <div
        className={`relative bg-white rounded-xl border shadow-sm transition-shadow ${
          selected ? 'border-teal ring-2 ring-teal/30' : 'border-edge hover:shadow-md'
        } cursor-pointer group`}
        style={{ width: NODE_W }}
        onClick={(e) => { e.stopPropagation(); onNavigate?.(item.id); }}
      >
        {/* Thumbnail */}
        <div className="relative h-[70px] overflow-hidden bg-surface rounded-t-xl border-b border-edge">
          {thumbnailSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSrc} alt={item.title} loading="lazy" className="w-full h-full object-cover object-top" />
          ) : isWebpage && item.url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-faint">
              <Globe size={16} />
              <span className="text-[9px] font-mono truncate max-w-[140px] px-2">{item.url}</span>
            </div>
          ) : isFigma ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-faint">
              <Figma size={16} />
              <span className="text-[9px] truncate max-w-[140px] px-2">{item.figma_frame_name || 'Figma'}</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-faint">
              <ImageIcon size={16} />
            </div>
          )}

          {/* Page path badge */}
          {item.page_path && (
            <span className="absolute top-1 left-1 px-1 py-px rounded bg-white/90 text-[9px] font-mono text-ink/70 border border-edge truncate max-w-[120px]">
              {item.page_path}
            </span>
          )}
        </div>

        <div className="px-2.5 py-2 flex flex-col gap-1.5">
          {/* Type icons + title */}
          <div className="flex items-center gap-1">
            {hasBoth ? (
              <>
                <Globe size={10} className="text-faint shrink-0" />
                <Figma size={10} className="text-purple-500 shrink-0" />
              </>
            ) : (
              <>
                {isWebpage ? <Globe size={10} className="text-faint shrink-0" /> :
                 isFigma ? <Figma size={10} className="text-purple-500 shrink-0" /> :
                 <ImageIcon size={10} className="text-faint shrink-0" />}
              </>
            )}
            <h4 className="text-xs text-ink truncate leading-tight flex-1 min-w-0 font-medium">
              {item.title}
            </h4>
          </div>

          {/* Status + comment count row */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-medium ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-ink/50">
              {commentCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <MessageSquareText size={9} className={unresolvedCount === 0 ? 'text-emerald-600' : ''} />
                  <span className={unresolvedCount > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                    {unresolvedCount > 0 ? unresolvedCount : commentCount}
                  </span>
                </span>
              )}
              {childCount > 0 && (
                <span className="text-faint">{childCount} sub</span>
              )}
            </div>
          </div>
        </div>

        {/* Add child button — hover */}
        {onAddChild && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-teal-hover"
            title="Add sub-page"
          >
            <Plus size={10} />
          </button>
        )}
      </div>
    </>
  );
}

const SitemapPageNode = memo(SitemapPageNodeComponent);
SitemapPageNode.displayName = 'SitemapPageNode';
export default SitemapPageNode;
