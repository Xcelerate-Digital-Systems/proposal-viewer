'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Trash2, Type, AlignLeft, Check, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type PickerVariation } from './ad-form-types';

/* ─── Sortable Existing Variation Row ────────────────────────────── */

export function SortableExistingVariationRow(props: {
  variation: PickerVariation;
  isActive: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onPatch: (patch: Partial<PickerVariation>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.variation.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <ExistingVariationRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ExistingVariationRow({
  variation, isActive, onToggle, onActivate, onPatch, dragHandleProps,
}: {
  variation: PickerVariation;
  isActive: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onPatch: (patch: Partial<PickerVariation>) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expanded = variation.selected && isActive;
  const displayLabel = variation.label?.trim() || variation.headline?.trim() || 'Untitled';
  const subtitle = variation.headline?.trim() ? variation.primary_text?.trim() || '' : '';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => { if (expanded) autoResize(); }, [expanded, variation.primary_text, autoResize]);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        variation.selected
          ? (isActive ? 'border-teal/40 bg-teal/5' : 'border-teal/20 bg-white')
          : 'border-edge-strong bg-white hover:bg-surface cursor-pointer'
      }`}
      onClick={() => {
        if (!variation.selected) onToggle();
        onActivate();
      }}
    >
      {/* Header row — always visible */}
      <div className="flex items-center gap-2.5 p-3">
        <button
          type="button"
          className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            variation.selected ? 'bg-teal border-teal text-white' : 'border-edge-hover hover:border-teal/50'
          }`}
        >
          {variation.selected && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          {expanded ? (
            <input
              type="text"
              value={variation.label}
              onChange={(e) => onPatch({ label: e.target.value })}
              placeholder="Variation name (optional)"
              className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs font-medium text-ink truncate">{displayLabel}</p>
          )}
          {!expanded && subtitle && <p className="text-detail text-faint line-clamp-2 mt-0.5">{subtitle}</p>}
        </div>
        {!expanded && (variation.usedByCount ?? 0) > 0 && (
          <span className="text-2xs text-dim shrink-0">
            {variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Expanded editor — shown when selected + active */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <AlignLeft size={10} /> Primary text
            </label>
            <textarea
              ref={textareaRef}
              value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <Type size={10} /> Headline
            </label>
            <input
              type="text"
              value={variation.headline}
              onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          {(variation.usedByCount ?? 0) > 0 && (
            <p className="text-2xs text-dim">
              Changes will update this copy across {variation.usedByCount} ad{variation.usedByCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sortable New Variation Editor ──────────────────────────────── */

export function SortableNewVariationEditor(props: {
  variation: PickerVariation;
  index: number;
  isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void;
  onActivate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.variation.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <NewVariationEditor {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function NewVariationEditor({
  variation, index, isActive, onPatch, onActivate, onRemove, canRemove, dragHandleProps,
}: {
  variation: PickerVariation;
  index: number;
  isActive: boolean;
  onPatch: (patch: Partial<PickerVariation>) => void;
  onActivate: () => void;
  onRemove: () => void;
  canRemove: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayLabel = variation.label?.trim() || variation.headline?.trim() || `Variation ${index + 1}`;
  const subtitle = variation.headline?.trim() ? variation.primary_text?.trim() || '' : variation.primary_text?.trim() || '';

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => { if (isActive) autoResize(); }, [isActive, variation.primary_text, autoResize]);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isActive ? 'border-teal/40 bg-teal/5' : 'border-edge-strong bg-white hover:bg-surface cursor-pointer'
      }`}
      onClick={() => { if (!isActive) onActivate(); }}
    >
      {/* Header: drag handle + badge + label + delete */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="text-faint hover:text-dim cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onActivate(); }}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-detail font-semibold shrink-0 transition-colors ${
            isActive ? 'bg-teal text-white' : 'bg-surface text-prose hover:bg-edge'
          }`}
        >
          {index + 1}
        </button>
        {isActive ? (
          <input
            type="text"
            value={variation.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder={`Variation ${index + 1} name (optional)`}
            className="flex-1 min-w-0 bg-transparent text-caption font-semibold text-ink placeholder:text-faint placeholder:font-normal outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="flex-1 min-w-0 text-xs font-medium text-ink truncate">{displayLabel}</p>
        )}
        {canRemove && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-faint hover:text-red-500 p-1 rounded shrink-0" title="Remove">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Collapsed subtitle */}
      {!isActive && subtitle && (
        <div className="px-3 pb-3 -mt-1">
          <p className="text-detail text-faint line-clamp-2">{subtitle}</p>
        </div>
      )}

      {/* Expanded body: primary text (auto-resize) + headline */}
      {isActive && (
        <div className="px-3 pb-3 pt-0 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <AlignLeft size={10} /> Primary text
            </label>
            <textarea
              ref={textareaRef}
              value={variation.primary_text}
              onChange={(e) => { onPatch({ primary_text: e.target.value }); autoResize(); }}
              placeholder="Body copy shown above the image…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none overflow-hidden"
              style={{ minHeight: 140 }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-faint mb-1">
              <Type size={10} /> Headline
            </label>
            <input
              type="text"
              value={variation.headline}
              onChange={(e) => onPatch({ headline: e.target.value })}
              placeholder="Short punchy headline…"
              className="w-full px-3 py-2 bg-white border border-edge-strong rounded-lg text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
