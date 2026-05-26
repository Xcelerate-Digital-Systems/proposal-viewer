'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import type { FeedbackMode } from './FeedbackToolbar';
import type { FeedbackComment } from '@/lib/supabase';
import { roughRect, roughLine } from '@/components/feedback/sketchy/roughPath';
import { hashStringToInt } from '@/components/feedback/sketchy/seed';

/* ─── Annotation data shape (stored as JSON in review_comments.annotation_data) ─── */

export interface AnnotationData {
  type: 'box' | 'arrow' | 'text';
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  overlay_text?: string;
}

interface DrawingOverlayProps {
  mode: FeedbackMode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAnnotationComplete: (pinX: number, pinY: number, annotation: AnnotationData) => void;
  annotationComments?: FeedbackComment[];
  highlightedCommentId?: string | null;
  onAnnotationClick?: (commentId: string) => void;
}

const ARROW_HEAD_PX = 14;
const ARROW_ANGLE = Math.PI / 7;
const STROKE_COLOR = '#017C87';
const STROKE_COLOR_DIM = 'rgba(1,124,135,0.7)';

/* ── Helper to draw sketchy arrow (shaft + two arrowhead arms) ── */
function drawSketchyArrow(
  x1: number, y1: number, x2: number, y2: number,
  seed: number, color: string, strokeWidth: number
) {
  const shaft = roughLine(x1, y1, x2, y2, {
    seed, roughness: 1.2, bowing: 1.2, stroke: color, strokeWidth, disableMultiStroke: true,
  });
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - ARROW_ANGLE;
  const a2 = angle + Math.PI + ARROW_ANGLE;
  const arrowOpts = {
    seed: seed + 1, roughness: 0.8, bowing: 0.5, stroke: color, strokeWidth, disableMultiStroke: true,
  };
  const arm1 = roughLine(x2, y2, x2 + Math.cos(a1) * ARROW_HEAD_PX, y2 + Math.sin(a1) * ARROW_HEAD_PX, arrowOpts);
  const arm2 = roughLine(x2, y2, x2 + Math.cos(a2) * ARROW_HEAD_PX, y2 + Math.sin(a2) * ARROW_HEAD_PX, arrowOpts);
  return [...shaft, ...arm1, ...arm2];
}

/* ─── Component ─── */

export default function DrawingOverlay({
  mode,
  containerRef,
  onAnnotationComplete,
  annotationComments = [],
  highlightedCommentId,
  onAnnotationClick,
}: DrawingOverlayProps) {
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const isDrawingMode = mode === 'box' || mode === 'arrow';
  const isTextMode = mode === 'text';
  const isActive = isDrawingMode || isTextMode;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const toPercent = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    },
    [containerRef]
  );

  const pctToPx = useCallback(
    (p: { x: number; y: number }) => ({ x: (p.x / 100) * size.w, y: (p.y / 100) * size.h }),
    [size]
  );

  // ── Mouse handlers for box/arrow ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingMode) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = toPercent(e.clientX, e.clientY);
      setStart(pos);
      setCurrent(pos);
      setDrawing(true);
    },
    [isDrawingMode, toPercent]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setCurrent(toPercent(e.clientX, e.clientY));
    },
    [drawing, toPercent]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !start || !current) return;
      e.preventDefault();
      setDrawing(false);

      if (mode === 'box') {
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const w = Math.abs(current.x - start.x);
        const h = Math.abs(current.y - start.y);
        if (w < 2 && h < 2) return;
        onAnnotationComplete(x, y, { type: 'box', width: w, height: h });
      } else if (mode === 'arrow') {
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) < 2) return;
        onAnnotationComplete(start.x, start.y, {
          type: 'arrow',
          endX: current.x,
          endY: current.y,
        });
      }

      setStart(null);
      setCurrent(null);
    },
    [drawing, start, current, mode, onAnnotationComplete]
  );

  // ── Text mode handlers ──
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isTextMode) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = toPercent(e.clientX, e.clientY);
      setTextPos(pos);
      setTextInput('');
    },
    [isTextMode, toPercent]
  );

  useEffect(() => {
    if (textPos && textRef.current) textRef.current.focus();
  }, [textPos]);

  const handleTextSubmit = useCallback(() => {
    if (!textPos || !textInput.trim()) return;
    onAnnotationComplete(textPos.x, textPos.y, {
      type: 'text',
      overlay_text: textInput.trim(),
    });
    setTextPos(null);
    setTextInput('');
  }, [textPos, textInput, onAnnotationComplete]);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTextPos(null);
        setTextInput('');
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTextSubmit();
      }
    },
    [handleTextSubmit]
  );

  /* ── Build sketchy paths for all saved box/arrow annotations ── */
  const savedPaths = useMemo(() => {
    if (size.w === 0 || size.h === 0) return [];
    const out: {
      commentId: string;
      isHighlighted: boolean;
      paths: { d: string; stroke: string; strokeWidth: number }[];
    }[] = [];
    for (const c of annotationComments) {
      const ann = c.annotation_data as unknown as AnnotationData | null;
      if (!ann || c.pin_x == null || c.pin_y == null) continue;
      const isHighlighted = c.id === highlightedCommentId;
      const color = isHighlighted ? STROKE_COLOR : STROKE_COLOR_DIM;
      const seed = hashStringToInt(c.id);
      const start = pctToPx({ x: c.pin_x, y: c.pin_y });

      if (ann.type === 'box' && ann.width && ann.height) {
        const w = (ann.width / 100) * size.w;
        const h = (ann.height / 100) * size.h;
        const paths = roughRect(start.x, start.y, w, h, {
          seed, roughness: 1.4, bowing: 1.5, stroke: color, strokeWidth: 2.2, disableMultiStroke: true,
        });
        out.push({ commentId: c.id, isHighlighted, paths });
      } else if (ann.type === 'arrow' && ann.endX != null && ann.endY != null) {
        const end = pctToPx({ x: ann.endX, y: ann.endY });
        const paths = drawSketchyArrow(start.x, start.y, end.x, end.y, seed, color, 2.2);
        out.push({ commentId: c.id, isHighlighted, paths });
      }
    }
    return out;
  }, [annotationComments, highlightedCommentId, size, pctToPx]);

  /* ── Live preview paths (re-generate during drag — that's fine, drawing is brief) ── */
  const livePaths = useMemo(() => {
    if (!drawing || !start || !current || size.w === 0) return null;
    const s = pctToPx(start);
    const c = pctToPx(current);
    const seed = 9999;
    if (mode === 'box') {
      const x = Math.min(s.x, c.x);
      const y = Math.min(s.y, c.y);
      const w = Math.abs(c.x - s.x);
      const h = Math.abs(c.y - s.y);
      return roughRect(x, y, w, h, {
        seed, roughness: 1.3, bowing: 1.5, stroke: STROKE_COLOR, strokeWidth: 2, disableMultiStroke: true,
      });
    }
    if (mode === 'arrow') {
      return drawSketchyArrow(s.x, s.y, c.x, c.y, seed, STROKE_COLOR, 2);
    }
    return null;
  }, [drawing, start, current, mode, size, pctToPx]);

  return (
    <>
      {/* Sketchy SVG overlay (pixel-aligned, not 0-100) */}
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${Math.max(size.w, 1)} ${Math.max(size.h, 1)}`}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      >
        {/* Saved annotations (box/arrow) */}
        {savedPaths.map(({ commentId, isHighlighted, paths }) => (
          <g
            key={commentId}
            className={`pointer-events-auto cursor-pointer ${isHighlighted ? 'animate-pulse' : ''}`}
            onClick={() => onAnnotationClick?.(commentId)}
          >
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}

        {/* Live drawing preview */}
        {livePaths?.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {/* Saved text annotations */}
      {annotationComments.map((c) => {
        const ann = c.annotation_data as unknown as AnnotationData | null;
        if (!ann || ann.type !== 'text' || !ann.overlay_text || c.pin_x == null || c.pin_y == null) return null;
        const isHighlighted = c.id === highlightedCommentId;
        return (
          <div
            key={c.id}
            className={`absolute z-20 px-2 py-1 rounded bg-teal/90 text-white font-hand text-sm max-w-[200px] truncate cursor-pointer hover:bg-teal transition-colors shadow-sketch ${
              isHighlighted ? 'ring-2 ring-paper ring-offset-1 animate-pulse' : ''
            }`}
            style={{
              left: `${c.pin_x}%`,
              top: `${c.pin_y}%`,
              transform: 'translate(-4px, -4px)',
            }}
            onClick={() => onAnnotationClick?.(c.id)}
          >
            {ann.overlay_text}
          </div>
        );
      })}

      {/* Interactive overlay for capturing mouse events */}
      {isActive && (
        <div
          className="absolute inset-0 z-30"
          style={{ cursor: isTextMode ? 'text' : 'crosshair' }}
          onMouseDown={isDrawingMode ? handleMouseDown : undefined}
          onMouseMove={isDrawingMode ? handleMouseMove : undefined}
          onMouseUp={isDrawingMode ? handleMouseUp : undefined}
          onClick={isTextMode ? handleClick : undefined}
        />
      )}

      {/* Text input form */}
      {textPos && (
        <div
          className="absolute z-40 bg-paper rounded-lg shadow-sketch-lg border-2 border-sketch-ink/70 p-2 w-[220px]"
          style={{
            left: `${textPos.x}%`,
            top: `${textPos.y}%`,
            transform: 'translate(-4px, -4px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            ref={textRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleTextKeyDown}
            placeholder="Type annotation…"
            rows={2}
            className="w-full px-2 py-1.5 rounded border border-sketch-ink/30 text-sm text-sketch-ink bg-paper resize-none focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              type="button"
              onClick={() => { setTextPos(null); setTextInput(''); }}
              className="px-2 py-0.5 font-hand text-sm text-sketch-ink/60 hover:text-sketch-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="px-2 py-0.5 rounded bg-teal text-white font-hand text-sm disabled:opacity-40 hover:bg-teal-hover transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </>
  );
}
