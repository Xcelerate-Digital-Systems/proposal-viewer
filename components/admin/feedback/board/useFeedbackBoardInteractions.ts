'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import type { ContextTarget } from '@/components/admin/shared/CanvasContextMenu';
import {
  FEEDBACK_PALETTE_DRAG_MIME,
  type PaletteDragPayload,
} from './FeedbackPalette';
import { useFeedbackBoardContextOrThrow, type NewShape } from './FeedbackBoardContext';
import type { FeedbackShapeType } from '@/lib/types/feedback';
import { roughRect, roughLine, roughPath } from '@/components/feedback/sketchy/roughPath';
import { genericVisualCentre as visualCentre, ALIGNMENT_TOLERANCE } from '@/components/admin/shared/board-utils';
import { DRAW_COLOR, DRAW_STROKE_WIDTH, MIN_SHAPE_SIZE, ARROW_HEAD, ARROW_ANGLE } from './feedback-board-config';
import type { BoardTool } from './BoardTopToolbar';

/**
 * Encapsulates all board-interaction callbacks:
 * - add helpers (palette click, drag-and-drop)
 * - drawing interaction (rect, ellipse, arrow, line, text)
 * - context-menu state
 * - alignment guides while dragging
 * - node-click -> open side drawer
 */
export function useFeedbackBoardInteractions(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportCentre: () => { x: number; y: number },
  activeTool: BoardTool,
  setActiveTool: (tool: BoardTool) => void,
) {
  const ctx = useFeedbackBoardContextOrThrow();
  const rf = useReactFlow();

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ horizontals: number[]; verticals: number[] }>(
    { horizontals: [], verticals: [] }
  );
  const rafRef = useRef<number>(0);

  const isDrawingTool =
    activeTool === 'rectangle' || activeTool === 'ellipse' ||
    activeTool === 'arrow' || activeTool === 'line';
  const isTextTool = activeTool === 'text';
  const isSelectTool = activeTool === 'select';

  /* ── Add helpers ─────────────────────────────────────────── */

  const addShapeAt = useCallback((shapeType: FeedbackShapeType, flowX: number, flowY: number) => {
    const offsetX = shapeType === 'decision' ? 120 : 54;
    const offsetY = shapeType === 'decision' ? 120 : 70;
    void ctx.createShape({
      shape_type: shapeType,
      x: Math.round(flowX - offsetX),
      y: Math.round(flowY - offsetY),
      width: null, height: null, end_x: null, end_y: null,
      content: null,
      color: DRAW_COLOR, stroke_width: DRAW_STROKE_WIDTH, dashed: false,
      font_size: null,
    });
  }, [ctx]);

  const handlePickShape = useCallback((shapeType: FeedbackShapeType) => {
    const c = viewportCentre();
    addShapeAt(shapeType, c.x, c.y);
  }, [addShapeAt, viewportCentre]);

  const handlePickTool = useCallback((tool: BoardTool) => {
    setActiveTool(tool);
  }, [setActiveTool]);

  const handlePickSticky = useCallback(() => {
    void ctx.addNote();
  }, [ctx]);

  /* ── Drag-and-drop from palette to canvas ───────────────── */

  const onPaletteDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FEEDBACK_PALETTE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onPaletteDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(FEEDBACK_PALETTE_DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    let payload: PaletteDragPayload;
    try { payload = JSON.parse(raw) as PaletteDragPayload; } catch { return; }
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (payload.kind === 'shape') {
      addShapeAt(payload.shapeType, flowPos.x, flowPos.y);
    } else {
      void (async () => {
        const note = await ctx.addNote();
        if (note) {
          await ctx.updateNote(note.id, {
            board_x: Math.round(flowPos.x - 100),
            board_y: Math.round(flowPos.y - 75),
          });
        }
      })();
    }
  }, [rf, ctx, addShapeAt]);

  /* ── Drawing interaction on the canvas ──────────────────── */

  const screenToFlow = useCallback(
    (clientX: number, clientY: number) => rf.screenToFlowPosition({ x: clientX, y: clientY }),
    [rf]
  );

  const onContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingTool) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.react-flow__panel')
      ) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = screenToFlow(e.clientX, e.clientY);
      setDrawStart(pos);
      setDrawCurrent(pos);
    },
    [isDrawingTool, screenToFlow]
  );

  const onContainerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawStart) return;
      setDrawCurrent(screenToFlow(e.clientX, e.clientY));
    },
    [drawStart, screenToFlow]
  );

  const onContainerMouseUp = useCallback(async () => {
    if (!drawStart || !drawCurrent) {
      setDrawStart(null); setDrawCurrent(null); return;
    }

    const dx = drawCurrent.x - drawStart.x;
    const dy = drawCurrent.y - drawStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let shape: NewShape | null = null;

    if (activeTool === 'rectangle' || activeTool === 'ellipse') {
      if (absDx < MIN_SHAPE_SIZE && absDy < MIN_SHAPE_SIZE) {
        setDrawStart(null); setDrawCurrent(null); return;
      }
      shape = {
        shape_type: activeTool,
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        width: absDx, height: absDy,
        end_x: null, end_y: null,
        content: null,
        color: DRAW_COLOR, stroke_width: DRAW_STROKE_WIDTH, dashed: false,
        font_size: null,
      };
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      if (Math.sqrt(dx * dx + dy * dy) < MIN_SHAPE_SIZE) {
        setDrawStart(null); setDrawCurrent(null); return;
      }
      shape = {
        shape_type: activeTool,
        x: drawStart.x, y: drawStart.y,
        width: null, height: null,
        end_x: dx, end_y: dy,
        content: null,
        color: DRAW_COLOR, stroke_width: DRAW_STROKE_WIDTH, dashed: false,
        font_size: null,
      };
    }

    if (shape) await ctx.createShape(shape);
    setDrawStart(null);
    setDrawCurrent(null);
    setActiveTool('select');
  }, [drawStart, drawCurrent, activeTool, ctx, setActiveTool]);

  const onPaneClickForText = useCallback(
    async (e: React.MouseEvent) => {
      if (!isTextTool) return;
      const pos = screenToFlow(e.clientX, e.clientY);
      await ctx.createShape({
        shape_type: 'text',
        x: pos.x, y: pos.y,
        width: null, height: null, end_x: null, end_y: null,
        content: null,
        color: DRAW_COLOR, stroke_width: DRAW_STROKE_WIDTH, dashed: false,
        font_size: 18,
      });
      setActiveTool('select');
    },
    [isTextTool, screenToFlow, ctx, setActiveTool]
  );

  /* ── Live drawing preview ──────────────────────────────── */

  const previewPaths = useMemo(() => {
    if (!drawStart || !drawCurrent || !isDrawingTool) return null;
    const viewport = rf.getViewport();
    const sx1 = drawStart.x * viewport.zoom + viewport.x;
    const sy1 = drawStart.y * viewport.zoom + viewport.y;
    const sx2 = drawCurrent.x * viewport.zoom + viewport.x;
    const sy2 = drawCurrent.y * viewport.zoom + viewport.y;
    const opts = {
      seed: 1, roughness: 1.8, bowing: 1.5,
      stroke: DRAW_COLOR, strokeWidth: DRAW_STROKE_WIDTH, disableMultiStroke: false,
    };

    if (activeTool === 'rectangle') {
      return roughRect(
        Math.min(sx1, sx2), Math.min(sy1, sy2),
        Math.abs(sx2 - sx1), Math.abs(sy2 - sy1),
        opts
      );
    }
    if (activeTool === 'ellipse') {
      const w = Math.abs(sx2 - sx1);
      const h = Math.abs(sy2 - sy1);
      const minX = Math.min(sx1, sx2);
      const minY = Math.min(sy1, sy2);
      return roughPath(
        `M ${minX + w / 2} ${minY} a ${w / 2} ${h / 2} 0 1 0 0 ${h} a ${w / 2} ${h / 2} 0 1 0 0 -${h}`,
        opts
      );
    }
    if (activeTool === 'arrow' || activeTool === 'line') {
      const shaft = roughLine(sx1, sy1, sx2, sy2, { ...opts, disableMultiStroke: true });
      if (activeTool === 'line') return shaft;
      const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      const arrowOpts = { ...opts, seed: 2, roughness: 1.1, bowing: 0.6 };
      const arm1 = roughLine(sx2, sy2, sx2 + Math.cos(a1) * ARROW_HEAD, sy2 + Math.sin(a1) * ARROW_HEAD, arrowOpts);
      const arm2 = roughLine(sx2, sy2, sx2 + Math.cos(a2) * ARROW_HEAD, sy2 + Math.sin(a2) * ARROW_HEAD, arrowOpts);
      return [...shaft, ...arm1, ...arm2];
    }
    return null;
  }, [drawStart, drawCurrent, isDrawingTool, activeTool, rf]);

  /* ── Right-click context menus ──────────────────────────── */

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    if (!isSelectTool) return;
    e.preventDefault();
    if (!node.selected) {
      rf.setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
    }
    setContextMenu({ kind: 'node', nodeId: node.id, clientX: e.clientX, clientY: e.clientY });
  }, [rf, isSelectTool]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!isSelectTool) return;
    e.preventDefault();
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setContextMenu({
      kind: 'pane', clientX: e.clientX, clientY: e.clientY,
      flowX: flowPos.x, flowY: flowPos.y,
    });
  }, [rf, isSelectTool]);

  /* ── Smart alignment guides while dragging ─────────────── */

  const onNodeDrag = useCallback((_e: React.MouseEvent, node: Node) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const others = rf.getNodes().filter((n) => n.id !== node.id && !n.selected);
      const drag = visualCentre(node);
      let bestH: number | null = null;
      let bestV: number | null = null;
      let bestDY = Infinity;
      let bestDX = Infinity;
      for (const o of others) {
        const oc = visualCentre(o);
        const dy = Math.abs(oc.cy - drag.cy);
        const dx = Math.abs(oc.cx - drag.cx);
        if (dy <= ALIGNMENT_TOLERANCE && dy < bestDY) {
          bestDY = dy;
          bestH = Math.round(oc.cy);
        }
        if (dx <= ALIGNMENT_TOLERANCE && dx < bestDX) {
          bestDX = dx;
          bestV = Math.round(oc.cx);
        }
      }
      setGuides({
        horizontals: bestH !== null ? [bestH] : [],
        verticals: bestV !== null ? [bestV] : [],
      });
    });
  }, [rf]);

  const onNodeDragStop = useCallback(() => {
    setGuides({ horizontals: [], verticals: [] });
  }, []);

  /* ── Click -> open the matching side drawer ───────────── */

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('shape-')) {
      setSelectedShapeId(node.id.slice(6));
      setSelectedNoteId(null);
      setSelectedItemId(null);
    } else if (node.id.startsWith('note-')) {
      setSelectedNoteId(node.id.slice(5));
      setSelectedShapeId(null);
      setSelectedItemId(null);
    } else {
      setSelectedItemId(node.id);
      setSelectedShapeId(null);
      setSelectedNoteId(null);
    }
  }, []);

  const clearDrawerSelection = useCallback(() => {
    setSelectedShapeId(null);
    setSelectedNoteId(null);
    setSelectedItemId(null);
  }, []);

  return {
    // state
    drawStart,
    drawCurrent,
    contextMenu,
    setContextMenu,
    selectedShapeId,
    setSelectedShapeId,
    selectedNoteId,
    setSelectedNoteId,
    selectedItemId,
    setSelectedItemId,
    guides,
    // derived
    isDrawingTool,
    isTextTool,
    isSelectTool,
    previewPaths,
    // add helpers
    addShapeAt,
    handlePickShape,
    handlePickTool,
    handlePickSticky,
    // drag-and-drop
    onPaletteDragOver,
    onPaletteDrop,
    // drawing
    onContainerMouseDown,
    onContainerMouseMove,
    onContainerMouseUp,
    onPaneClickForText,
    // context menus
    onNodeContextMenu,
    onPaneContextMenu,
    // alignment guides
    onNodeDrag,
    onNodeDragStop,
    // node click
    onNodeClick,
    clearDrawerSelection,
  };
}
