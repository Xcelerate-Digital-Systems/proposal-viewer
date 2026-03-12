// components/reviews/feedback/DrawingOverlay.tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FeedbackMode } from './FeedbackToolbar';
import type { ReviewComment } from '@/lib/supabase';

/* ─── Annotation data shape (stored as JSON in review_comments.annotation_data) ─── */

export interface AnnotationData {
  type: 'box' | 'arrow' | 'text';
  // Box: position is pin_x/pin_y (top-left corner), width/height in %
  width?: number;
  height?: number;
  // Arrow: start is pin_x/pin_y, end is endX/endY in %
  endX?: number;
  endY?: number;
  // Text: overlay text label
  overlay_text?: string;
}

interface DrawingOverlayProps {
  mode: FeedbackMode;
  /** Container ref to calculate % coordinates */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Called when a drawing annotation is completed */
  onAnnotationComplete: (pinX: number, pinY: number, annotation: AnnotationData) => void;
  /** Existing annotation comments (to render saved annotations) */
  annotationComments?: ReviewComment[];
  /** Highlighted comment ID (to pulse the annotation) */
  highlightedCommentId?: string | null;
  /** Click existing annotation → scroll to comment */
  onAnnotationClick?: (commentId: string) => void;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  // Text mode state
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const isDrawingMode = mode === 'box' || mode === 'arrow';
  const isTextMode = mode === 'text';
  const isActive = isDrawingMode || isTextMode;

  // Convert pixel position to % relative to container
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
        if (w < 2 && h < 2) return; // Too small
        onAnnotationComplete(x, y, { type: 'box', width: w, height: h });
      } else if (mode === 'arrow') {
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) < 2) return; // Too short
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

  // ── Click handler for text ──
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

  // Focus text input when positioned
  useEffect(() => {
    if (textPos && textRef.current) {
      textRef.current.focus();
    }
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

  // Cancel text on Escape
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

  return (
    <>
      {/* Drawing + saved annotations overlay */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#017C87" />
          </marker>
          <marker
            id="arrowhead-saved"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#017C87" opacity="0.7" />
          </marker>
        </defs>

        {/* Saved annotations */}
        {annotationComments.map((c) => {
          const ann = c.annotation_data as unknown as AnnotationData | null;
          if (!ann || c.pin_x == null || c.pin_y == null) return null;
          const isHighlighted = c.id === highlightedCommentId;
          const opacity = isHighlighted ? 1 : 0.6;

          if (ann.type === 'box' && ann.width && ann.height) {
            return (
              <rect
                key={c.id}
                x={c.pin_x}
                y={c.pin_y}
                width={ann.width}
                height={ann.height}
                fill="none"
                stroke="#017C87"
                strokeWidth="0.3"
                opacity={opacity}
                className={`cursor-pointer pointer-events-auto ${isHighlighted ? 'animate-pulse' : ''}`}
                onClick={() => onAnnotationClick?.(c.id)}
                vectorEffect="non-scaling-stroke"
              />
            );
          }

          if (ann.type === 'arrow' && ann.endX != null && ann.endY != null) {
            return (
              <line
                key={c.id}
                x1={c.pin_x}
                y1={c.pin_y}
                x2={ann.endX}
                y2={ann.endY}
                stroke="#017C87"
                strokeWidth="0.3"
                markerEnd="url(#arrowhead-saved)"
                opacity={opacity}
                className={`cursor-pointer pointer-events-auto ${isHighlighted ? 'animate-pulse' : ''}`}
                onClick={() => onAnnotationClick?.(c.id)}
                vectorEffect="non-scaling-stroke"
              />
            );
          }

          return null;
        })}

        {/* Live drawing preview */}
        {drawing && start && current && mode === 'box' && (
          <rect
            x={Math.min(start.x, current.x)}
            y={Math.min(start.y, current.y)}
            width={Math.abs(current.x - start.x)}
            height={Math.abs(current.y - start.y)}
            fill="rgba(1,124,135,0.08)"
            stroke="#017C87"
            strokeWidth="0.3"
            strokeDasharray="1,0.5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {drawing && start && current && mode === 'arrow' && (
          <line
            x1={start.x}
            y1={start.y}
            x2={current.x}
            y2={current.y}
            stroke="#017C87"
            strokeWidth="0.3"
            markerEnd="url(#arrowhead)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Saved text annotations */}
      {annotationComments.map((c) => {
        const ann = c.annotation_data as unknown as AnnotationData | null;
        if (!ann || ann.type !== 'text' || !ann.overlay_text || c.pin_x == null || c.pin_y == null) return null;
        const isHighlighted = c.id === highlightedCommentId;
        return (
          <div
            key={c.id}
            className={`absolute z-20 px-2 py-1 rounded bg-teal/80 text-white text-[11px] font-medium max-w-[200px] truncate cursor-pointer hover:bg-teal transition-colors ${
              isHighlighted ? 'ring-2 ring-white ring-offset-1 animate-pulse' : ''
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
          className="absolute z-40 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-[200px]"
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
            className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              type="button"
              onClick={() => { setTextPos(null); setTextInput(''); }}
              className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTextSubmit}
              disabled={!textInput.trim()}
              className="px-2 py-0.5 rounded bg-teal text-white text-[10px] font-medium disabled:opacity-40 hover:bg-[#01434A] transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </>
  );
}
