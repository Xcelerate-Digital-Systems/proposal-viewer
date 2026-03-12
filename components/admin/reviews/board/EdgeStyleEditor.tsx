// components/admin/reviews/board/EdgeStyleEditor.tsx
'use client';

import { Trash2 } from 'lucide-react';

/* ─── Edge color presets ───────────────────────────────────────── */

export const EDGE_COLORS = [
  { value: '#94a3b8', label: 'Gray' },
  { value: '#017C87', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
];

/* ─── Types ────────────────────────────────────────────────────── */

export interface EdgeStyleEditorProps {
  label: string;
  color: string;
  dashed: boolean;
  animated: boolean;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onDashedChange: (dashed: boolean) => void;
  onAnimatedChange: (animated: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/* ─── Component ────────────────────────────────────────────────── */

export default function EdgeStyleEditor({
  label,
  color,
  dashed,
  animated,
  onLabelChange,
  onColorChange,
  onDashedChange,
  onAnimatedChange,
  onSave,
  onDelete,
  onClose,
}: EdgeStyleEditorProps) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute top-4 right-4 z-40 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-[280px]">
        <h4 className="text-xs font-semibold text-gray-700 mb-3">Edit Connection</h4>

        {/* Label */}
        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Clicks CTA, Submits form..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal mb-3"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onClose();
          }}
        />

        {/* Color */}
        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
          Color
        </label>
        <div className="flex items-center gap-1.5 mb-3">
          {EDGE_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c.value ? 'border-gray-600 scale-110' : 'border-gray-200'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>

        {/* Style toggles */}
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dashed}
              onChange={(e) => onDashedChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-teal focus:ring-teal/20"
            />
            <span className="text-xs text-gray-600">Dashed</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={animated}
              onChange={(e) => onAnimatedChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-teal focus:ring-teal/20"
            />
            <span className="text-xs text-gray-600">Animated</span>
          </label>
        </div>

        {/* Preview line */}
        <div className="h-8 mb-3 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
          <svg width="120" height="20" viewBox="0 0 120 20">
            <defs>
              <marker
                id="preview-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            </defs>
            <line
              x1="10"
              y1="10"
              x2="110"
              y2="10"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={dashed ? '6 3' : 'none'}
              markerEnd="url(#preview-arrow)"
            />
          </svg>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal hover:bg-[#01434A] rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
