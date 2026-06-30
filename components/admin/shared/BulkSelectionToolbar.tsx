'use client';

import { AlignCenterHorizontal, AlignCenterVertical, GripHorizontal, GripVertical, Group, Ungroup, Trash2 } from 'lucide-react';

interface Props {
  count: number;
  onAlignH: () => void;
  onAlignV: () => void;
  onDistributeH: () => void;
  onDistributeV: () => void;
  onDelete: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  hasGroup?: boolean;
}

export default function BulkSelectionToolbar({
  count, onAlignH, onAlignV, onDistributeH, onDistributeV, onDelete,
  onGroup, onUngroup, hasGroup,
}: Props) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-1 bg-white border border-edge shadow-sm rounded-lg px-2 py-1">
      <span className="text-2xs text-muted font-medium px-1 whitespace-nowrap">{count} selected</span>
      <div className="w-px h-5 bg-edge mx-0.5" />
      <Btn icon={AlignCenterHorizontal} title="Align centres horizontally" onClick={onAlignH} />
      <Btn icon={AlignCenterVertical} title="Align centres vertically" onClick={onAlignV} />
      {count >= 3 && (
        <>
          <Btn icon={GripHorizontal} title="Distribute horizontally" onClick={onDistributeH} />
          <Btn icon={GripVertical} title="Distribute vertically" onClick={onDistributeV} />
        </>
      )}
      {(onGroup || onUngroup) && (
        <>
          <div className="w-px h-5 bg-edge mx-0.5" />
          {hasGroup && onUngroup && (
            <Btn icon={Ungroup} title="Ungroup" onClick={onUngroup} />
          )}
          {onGroup && !hasGroup && (
            <Btn icon={Group} title="Group selected" onClick={onGroup} />
          )}
        </>
      )}
      <div className="w-px h-5 bg-edge mx-0.5" />
      <Btn icon={Trash2} title={`Delete ${count} items`} onClick={onDelete} danger />
    </div>
  );
}

function Btn({ icon: Icon, title, onClick, danger }: {
  icon: React.ComponentType<{ size: number }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
        danger
          ? 'text-rose-500 hover:text-white hover:bg-rose-500'
          : 'text-ink/70 hover:text-ink hover:bg-surface'
      }`}
      title={title}
    >
      <Icon size={14} />
    </button>
  );
}
