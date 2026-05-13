'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, ArrowRight, ArrowLeft, ArrowLeftRight, Minus, ChevronDown } from 'lucide-react';
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
  labelFontSize: number;
  labelColor: string;
}

export type EdgeStylePatch = {
  label?: string | null;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  arrowDir?: ArrowDirection;
  labelFontSize?: number;
  labelColor?: string;
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
    labelFontSize: (data.labelFontSize as number) ?? (style.labelFontSize as number) ?? 16,
    labelColor: (data.labelColor as string) ?? (style.labelColor as string) ?? '#2B2B2B',
  };
}

type PopId = 'stroke-color' | 'stroke-width' | 'label-color' | null;

export default function EdgeStyleEditor({ edge, onUpdate, onDelete, onClose }: EdgeStyleEditorProps) {
  const current = readStyle(edge);
  const [labelDraft, setLabelDraft] = useState(current.label ?? '');
  const [openPop, setOpenPop] = useState<PopId>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep local draft in sync when switching to a different edge
  useEffect(() => {
    setLabelDraft(current.label ?? '');
    setOpenPop(null);
  }, [edge.id, current.label]);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!openPop) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenPop(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPop(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openPop]);

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

  const currentWidth = STROKE_WIDTHS.find((w) => Math.abs(w.value - current.strokeWidth) < 0.4) ?? STROKE_WIDTHS[1];

  return (
    <div
      ref={rootRef}
      className="bg-white rounded-xl border border-edge shadow-lg px-1.5 py-1 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Stroke colour */}
      <div className="relative">
        <ToolbarBtn
          title="Stroke color"
          onClick={() => setOpenPop(openPop === 'stroke-color' ? null : 'stroke-color')}
          active={openPop === 'stroke-color'}
        >
          <span
            className="w-4 h-4 rounded-full border border-edge"
            style={{ backgroundColor: current.color }}
          />
          <ChevronDown size={11} className="opacity-60" />
        </ToolbarBtn>
        {openPop === 'stroke-color' && (
          <Pop>
            <div className="flex gap-1.5">
              {EDGE_COLORS.map((c) => (
                <ColorSwatch
                  key={c.value}
                  color={c.value}
                  title={c.label}
                  active={c.value.toLowerCase() === current.color.toLowerCase()}
                  onClick={() => { onUpdate(edge.id, { color: c.value }); setOpenPop(null); }}
                />
              ))}
            </div>
          </Pop>
        )}
      </div>

      {/* Stroke width */}
      <div className="relative">
        <ToolbarBtn
          title={`Width: ${currentWidth.label}`}
          onClick={() => setOpenPop(openPop === 'stroke-width' ? null : 'stroke-width')}
          active={openPop === 'stroke-width'}
        >
          <span
            className="block bg-ink rounded-full"
            style={{ width: 16, height: currentWidth.dot }}
          />
          <ChevronDown size={11} className="opacity-60" />
        </ToolbarBtn>
        {openPop === 'stroke-width' && (
          <Pop>
            <div className="flex gap-1">
              {STROKE_WIDTHS.map((w) => (
                <ToolbarBtn
                  key={w.value}
                  active={Math.abs(w.value - current.strokeWidth) < 0.4}
                  onClick={() => { onUpdate(edge.id, { strokeWidth: w.value }); setOpenPop(null); }}
                  title={w.label}
                >
                  <span className="block bg-ink rounded-full" style={{ width: 18, height: w.dot }} />
                </ToolbarBtn>
              ))}
            </div>
          </Pop>
        )}
      </div>

      <Divider />

      {/* Line style */}
      <ToolbarBtn
        active={lineStyle === 'solid'}
        onClick={() => setLineStyle('solid')}
        title="Solid"
      >
        <svg width={20} height={10} viewBox="0 0 20 10">
          <line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn
        active={lineStyle === 'dashed'}
        onClick={() => setLineStyle('dashed')}
        title="Dashed"
      >
        <svg width={20} height={10} viewBox="0 0 20 10">
          <line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn
        active={lineStyle === 'animated'}
        onClick={() => setLineStyle('animated')}
        title="Animated"
      >
        <svg width={20} height={10} viewBox="0 0 20 10">
          <line
            x1="2" y1="5" x2="18" y2="5"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"
            style={{ animation: 'sketch-dashflow 0.6s linear infinite' }}
          />
        </svg>
      </ToolbarBtn>

      <Divider />

      {/* Arrow direction */}
      <ToolbarBtn
        active={current.arrowDir === 'none'}
        onClick={() => onUpdate(edge.id, { arrowDir: 'none' })}
        title="No arrowheads"
      >
        <Minus size={14} strokeWidth={2.2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={current.arrowDir === 'target'}
        onClick={() => onUpdate(edge.id, { arrowDir: 'target' })}
        title="Arrow on target"
      >
        <ArrowRight size={14} strokeWidth={2.2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={current.arrowDir === 'source'}
        onClick={() => onUpdate(edge.id, { arrowDir: 'source' })}
        title="Arrow on source"
      >
        <ArrowLeft size={14} strokeWidth={2.2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={current.arrowDir === 'both'}
        onClick={() => onUpdate(edge.id, { arrowDir: 'both' })}
        title="Arrow on both ends"
      >
        <ArrowLeftRight size={14} strokeWidth={2.2} />
      </ToolbarBtn>

      <Divider />

      {/* Label */}
      <input
        type="text"
        value={labelDraft}
        placeholder="Label…"
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
        className="w-32 h-7 px-2 rounded-md border border-edge bg-surface text-xs text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
      />

      {/* Label font size */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={8}
          max={96}
          value={current.labelFontSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 8 && v <= 96) {
              onUpdate(edge.id, { labelFontSize: v });
            }
          }}
          className="w-12 h-7 px-1.5 rounded-md border border-edge bg-surface text-xs text-center text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          title="Label font size (px)"
        />
        <span className="text-[10px] text-ink/50">px</span>
      </div>

      {/* Label colour */}
      <div className="relative">
        <ToolbarBtn
          title="Label color"
          onClick={() => setOpenPop(openPop === 'label-color' ? null : 'label-color')}
          active={openPop === 'label-color'}
        >
          <span className="text-ink/70 text-[11px] leading-none font-bold">A</span>
          <span
            className="w-3 h-3 rounded-full border border-edge"
            style={{ backgroundColor: current.labelColor }}
          />
        </ToolbarBtn>
        {openPop === 'label-color' && (
          <Pop>
            <div className="flex gap-1.5">
              {EDGE_COLORS.map((c) => (
                <ColorSwatch
                  key={c.value}
                  color={c.value}
                  title={c.label}
                  active={c.value.toLowerCase() === current.labelColor.toLowerCase()}
                  onClick={() => { onUpdate(edge.id, { labelColor: c.value }); setOpenPop(null); }}
                />
              ))}
            </div>
          </Pop>
        )}
      </div>

      <Divider />

      {/* Delete */}
      <button
        onClick={onDelete}
        className="h-7 w-7 rounded-md flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
        title="Delete edge"
        type="button"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-edge mx-0.5" />;
}

function Pop({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-20 bg-white rounded-lg border border-edge shadow-lg p-2"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function ColorSwatch({ color, active, title, onClick }: { color: string; active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
        active ? 'border-ink ring-2 ring-teal/40 scale-105' : 'border-edge'
      }`}
      style={{ backgroundColor: color }}
      type="button"
    />
  );
}

function ToolbarBtn({
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
      className={`h-7 min-w-[28px] px-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${
        active
          ? 'bg-teal text-white shadow-sm'
          : 'text-ink/80 hover:bg-surface'
      }`}
    >
      {children}
    </button>
  );
}
