'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  MessageSquareText, ExternalLink, Globe, Mail, Smartphone,
  Image as ImageIcon, Video, FileText, Megaphone, Search,
} from 'lucide-react';
import { type FeedbackItem, type FeedbackItemType } from '@/lib/supabase';

interface KanbanCardProps {
  item: FeedbackItem;
  commentCount: number;
  unresolvedCount: number;
  onOpen: (itemId: string) => void;
}

const TYPE_META: Record<FeedbackItemType, { label: string; Icon: typeof Globe; iconBg: string; iconColor: string }> = {
  webpage:   { label: 'Webpage',   Icon: Globe,      iconBg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  email:     { label: 'Email',     Icon: Mail,       iconBg: 'bg-violet-50',  iconColor: 'text-violet-600' },
  sms:       { label: 'SMS',       Icon: Smartphone, iconBg: 'bg-green-50',   iconColor: 'text-green-600' },
  image:     { label: 'Image',     Icon: ImageIcon,  iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  video:     { label: 'Video',     Icon: Video,      iconBg: 'bg-rose-50',    iconColor: 'text-rose-600' },
  pdf:       { label: 'PDF',       Icon: FileText,   iconBg: 'bg-red-50',     iconColor: 'text-red-600' },
  ad:        { label: 'Meta Ad',   Icon: Megaphone,  iconBg: 'bg-blue-50',    iconColor: 'text-blue-600' },
  google_ad: { label: 'Google Ad', Icon: Search,     iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600' },
};

export default function KanbanCard({
  item, commentCount, unresolvedCount, onOpen,
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
      className={`group relative bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 hover:shadow-sm transition-all ${
        isDragging ? 'ring-2 ring-teal/40' : ''
      }`}
    >
      {/* Full-card drag surface sits behind the interactive footer so click-to-open still works. */}
      <div
        {...listeners}
        {...attributes}
        className="absolute inset-0 cursor-grab active:cursor-grabbing rounded-xl"
        aria-label={`Drag ${item.title}`}
      />

      <div className="relative flex items-start gap-2.5">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
          <Icon size={14} className={meta.iconColor} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h4 className="text-sm font-medium text-gray-900 truncate leading-tight flex-1 min-w-0">
              {item.title}
            </h4>
            {item.version > 1 && (
              <span className="text-[10px] font-semibold text-gray-400 shrink-0">v{item.version}</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{meta.label}</p>
        </div>
      </div>

      <div className="relative mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <MessageSquareText size={11} />
          <span>
            {commentCount}
            {unresolvedCount > 0 && (
              <span className="text-amber-600 ml-0.5 font-semibold">({unresolvedCount})</span>
            )}
          </span>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item.id);
          }}
          className="relative z-10 inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:text-teal-hover"
        >
          {isWebpage ? <ExternalLink size={11} /> : null}
          Open
        </button>
      </div>
    </div>
  );
}
