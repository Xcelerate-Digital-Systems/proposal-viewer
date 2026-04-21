'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, X, ArrowRight, ArrowLeft, ArrowLeftRight, Minus } from 'lucide-react';
import type { Edge } from '@xyflow/react';

export type ArrowDirection = 'none' | 'source' | 'target' | 'both';

export const EDGE_COLORS = [
  { value: '#2B2B2B', label: 'Ink' },
  { value: '#017C87', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
];

const STROKE_WIDTHS: { value: number; label: string; dot: number }[] = [
  { value: 1.4, label: 'Thin', dot: 1.4 },
  { value: 2.2, label: 'Medium', dot: 2.4 },
  { value: 3.6, label: 'Thick', dot: 3.8 },
];

type LineStyle = 'solid' | 'dashed' | 'animated';

interface EdgeStyle {
  label: string | null;
  color: string;
  strokeWidth: number;
  dashed: boolean;
  animated: boolean;
  arrowDir: ArrowDirection;
}

export type EdgeStylePatch = {
  label?: string | null;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  arrowDir?: ArrowDirection;
};

export interface EdgeStyleEditorProps {
  edge: Edge;
  onUpdate: (edgeId: string, patch: EdgeStylePatch) => void | Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

function readStyle(edge: Edge): EdgeStyle {
  const data = (edge.data || {}) as Record<string, unknown>;
  const style = (edge.style || {}) as Record<string, unknown>;
  const raw = (data.arrowDir as string) ?? 'target';
  const arrowDir: ArrowDirection = raw === 'none' || raw === 'source' || raw === 'both' ? raw as ArrowDirection : 'target';
  return {
    label: (data.label as string | null) ?? (edge.label as string | null) ?? null,
    color: (data.color as string) ?? (style.stroke as string) ?? '#2B2B2B',
    strokeWidth: (style.strokeWidth as number) ?? 2.2,
    dashed: !!(data.dashed as boolean),
    animated: !!edge.animated,
    arrowDir,
  };
}

export default function EdgeStyleEditor({ edge, onUpdate, onDelete, onClose }: EdgeStyleEditorProps) {
  const current = readStyle(edge);
  const [labelDraft, setLabelDraft] = useState(current.label ?? '');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local draft in sync when switching to a different edge
  useEffect(() => {
    setLabelDraft(current.label ?? '');
  }, [edge.id, current.label]);

  const debouncedLabelSave = (v: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onUpdate(edge.id, { label: v });
    }, 350);
  };

  const lineStyle: LineStyle = current.animated ? 'animated' : current.dashed ? 'dashed' : 'solid';
  const setLineStyle = (next: LineStyle) => {
    onUpdate(edge.id, {
      dashed: next === 'dashed',
      animated: next === 'animated',
    });
  };

  return (
    <div
      className="bg-paper rounded-xl border-2 border-sketch-ink/70 shadow-sketch-lg px-2 py-2 font-hand w-[420px] max-w-[calc(100vw-32px)]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-sketch-ink/60">
          Arrow
        </span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-sketch-ink/50 hover:text-sketch-ink hover:bg-paper-dark transition-colors"
          title="Close"
          type="button"
        >
          <X size={13} />
        </button>
      </div>

      {/* Stroke colour */}
      <Row label="Stroke">
        {EDGE_COLORS.map((c) => (
          <ColorSwatch
            key={c.value}
            color={c.value}
            title={c.label}
            active={c.value.toLowerCase() === current.color.toLowerCase()}
            onClick={() => onUpdate(edge.id, { color: c.value })}
          />
        ))}
      </Row>

      {/* Stroke width */}
      <Row label="Width">
        {STROKE_WIDTHS.map((w) => (
          <ToolbarButton
            key={w.value}
            active={Math.abs(w.value - current.strokeWidth) < 0.4}
            onClick={() => onUpdate(edge.id, { strokeWidth: w.value })}
            title={w.label}
          >
            <span
              className="block bg-sketch-ink rounded-full"
              style={{ width: 16, height: w.dot }}
            />
          </ToolbarButton>
        ))}
      </Row>

      {/* Style */}
      <Row label="Style">
        <ToolbarButton
          active={lineStyle === 'solid'}
          onClick={() => setLineStyle('solid')}
          title="Solid"
        >
          <svg width={24} height={12} viewBox="0 0 24 12">
            <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          active={lineStyle === 'dashed'}
          onClick={() => setLineStyle('dashed')}
          title="Dashed"
        >
          <svg width={24} height={12} viewBox="0 0 24 12">
            <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          active={lineStyle === 'animated'}
          onClick={() => setLineStyle('animated')}
          title="Animated"
        >
          <svg width={24} height={12} viewBox="0 0 24 12">
            <line
              x1="2" y1="6" x2="22" y2="6"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"
              style={{ animation: 'sketch-dashflow 0.6s linear infinite' }}
            />
          </svg>
        </ToolbarButton>
      </Row>

      {/* Arrow */}
      <Row label="Arrow">
        <ToolbarButton
          active={current.arrowDir === 'none'}
          onClick={() => onUpdate(edge.id, { arrowDir: 'none' })}
          title="No arrowheads"
        >
          <Minus size={14} strokeWidth={2.2} />
        </ToolbarButton>
        <ToolbarButton
          active={current.arrowDir === 'target'}
          onClick={() => onUpdate(edge.id, { arrowDir: 'target' })}
          title="Arrow on target"
        >
          <ArrowRight size={14} strokeWidth={2.2} />
        </ToolbarButton>
        <ToolbarButton
          active={current.arrowDir === 'source'}
          onClick={() => onUpdate(edge.id, { arrowDir: 'source' })}
          title="Arrow on source (flipped)"
        >
          <ArrowLeft size={14} strokeWidth={2.2} />
        </ToolbarButton>
        <ToolbarButton
          active={current.arrowDir === 'both'}
          onClick={() => onUpdate(edge.id, { arrowDir: 'both' })}
          title="Arrow on both ends"
        >
          <ArrowLeftRight size={14} strokeWidth={2.2} />
        </ToolbarButton>
      </Row>

      {/* Label */}
      <Row label="Label">
        <input
          type="text"
          value={labelDraft}
          placeholder="e.g. Clicks CTA"
          onChange={(e) => {
            setLabelDraft(e.target.value);
            debouncedLabelSave(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              onUpdate(edge.id, { label: labelDraft });
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') onClose();
          }}
          className="flex-1 px-2 py-1 rounded-md border border-sketch-ink/30 bg-paper-dark text-sm text-sketch-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal font-hand"
        />
      </Row>

      {/* Delete */}
      <div className="flex items-center justify-end mt-2 px-1">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-hand text-red-500 hover:bg-red-50 transition-colors"
          type="button"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-sketch-ink/50 w-12 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ColorSwatch({ color, active, title, onClick }: { color: string; active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
        active ? 'border-sketch-ink ring-2 ring-teal/40 scale-105' : 'border-sketch-ink/30'
      }`}
      style={{ backgroundColor: color }}
      type="button"
    />
  );
}

function ToolbarButton({
  active, onClick, children, title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      type="button"
      className={`h-7 min-w-[32px] px-2 rounded-md flex items-center justify-center border transition-colors ${
        active
          ? 'bg-teal text-white border-teal shadow-sketch'
          : 'bg-paper text-sketch-ink/80 border-sketch-ink/30 hover:bg-paper-dark'
      }`}
    >
      {children}
    </button>
  );
}
