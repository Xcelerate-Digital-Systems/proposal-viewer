'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  MessageSquareText, ExternalLink, Globe, Mail, Smartphone,
  Image as ImageIcon, Video, FileText, Megaphone, Search, RectangleHorizontal, ClipboardList,
  Check, RefreshCw,
} from 'lucide-react';
import { type FeedbackItem, type FeedbackItemType } from '@/lib/supabase';

export type ItemDecisionTally = {
  approved: number;
  changesRequested: number;
};

interface KanbanCardProps {
  item: FeedbackItem;
  commentCount: number;
  unresolvedCount: number;
  decisionTally?: ItemDecisionTally;
  onOpen: (itemId: string) => void;
}

const TYPE_META: Record<FeedbackItemType, { label: string; Icon: typeof Globe; iconBg: string; iconColor: string }> = {
  webpage:   { label: 'Webpage',   Icon: Globe,      iconBg: 'bg-surface',    iconColor: 'text-muted' },
  email:     { label: 'Email',     Icon: Mail,       iconBg: 'bg-surface',    iconColor: 'text-muted' },
  sms:       { label: 'SMS',       Icon: Smartphone, iconBg: 'bg-surface',    iconColor: 'text-muted' },
  image:     { label: 'Image',     Icon: ImageIcon,  iconBg: 'bg-surface',    iconColor: 'text-muted' },
  video:     { label: 'Video',     Icon: Video,      iconBg: 'bg-surface',    iconColor: 'text-muted' },
  pdf:       { label: 'PDF',       Icon: FileText,   iconBg: 'bg-surface',    iconColor: 'text-muted' },
  ad:        { label: 'Meta Ad',   Icon: Megaphone,  iconBg: 'bg-surface',    iconColor: 'text-muted' },
  google_search_ad: { label: 'Google Search Ad', Icon: Search,              iconBg: 'bg-surface',    iconColor: 'text-muted' },
  google_banner_ad: { label: 'Google Banner Ad', Icon: RectangleHorizontal, iconBg: 'bg-surface',    iconColor: 'text-muted' },
  meta_lead_form: { label: 'Lead Form', Icon: ClipboardList, iconBg: 'bg-surface', iconColor: 'text-muted' },
};

export default function KanbanCard({
  item, commentCount, unresolvedCount, decisionTally, onOpen,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { kind: 'item' },
  });

  const meta = TYPE_META[item.type];
  const isWebpage = item.type === 'webpage';
  const Icon = meta.Icon;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 p-3.5 transition-all ${
        isDragging ? 'ring-2 ring-teal/40' : ''
      }`}
    >
      {/* Top half is the drag handle — large, obvious grab target. */}
      <div
        {...listeners}
        {...attributes}
        className="flex items-start gap-2.5 cursor-grab active:cursor-grabbing -m-3.5 p-3.5 rounded-t-2xl"
        aria-label={`Drag ${item.title}`}
      >
        <div className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${meta.iconBg}`}>
          <Icon size={15} className={meta.iconColor} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h4 className="text-caption font-medium text-ink truncate leading-tight flex-1 min-w-0">
              {item.title}
            </h4>
            {item.version > 1 && (
              <span className="text-2xs font-semibold text-faint shrink-0">v{item.version}</span>
            )}
          </div>
          <p className="text-detail text-faint mt-0.5 truncate">{meta.label}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
        <div className="flex items-center gap-2 text-detail text-dim">
          <div className="flex items-center gap-1">
            <MessageSquareText size={11} className={commentCount > 0 && unresolvedCount === 0 ? 'text-emerald-600' : ''} />
            {commentCount === 0 ? (
              <span>0</span>
            ) : unresolvedCount > 0 ? (
              <span className="flex items-center gap-1">
                <span className="text-amber-600 font-semibold">{unresolvedCount} open</span>
                {commentCount - unresolvedCount > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-emerald-600">{commentCount - unresolvedCount} resolved</span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">{commentCount} resolved</span>
            )}
          </div>
          {decisionTally && (decisionTally.approved > 0 || decisionTally.changesRequested > 0) && (
            <>
              <span className="text-gray-200">·</span>
              {decisionTally.approved > 0 && (
                <div
                  className="flex items-center gap-0.5 text-emerald-600 font-semibold"
                  title={`${decisionTally.approved} approved this version`}
                >
                  <Check size={11} />
                  {decisionTally.approved}
                </div>
              )}
              {decisionTally.changesRequested > 0 && (
                <div
                  className="flex items-center gap-0.5 text-orange-600 font-semibold"
                  title={`${decisionTally.changesRequested} requested changes`}
                >
                  <RefreshCw size={11} />
                  {decisionTally.changesRequested}
                </div>
              )}
            </>
          )}
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item.id);
          }}
          className="relative z-10 inline-flex items-center gap-1 text-detail font-medium text-teal hover:text-teal-hover"
        >
          {isWebpage ? <ExternalLink size={11} /> : null}
          Open
        </button>
      </div>
    </div>
  );
}
