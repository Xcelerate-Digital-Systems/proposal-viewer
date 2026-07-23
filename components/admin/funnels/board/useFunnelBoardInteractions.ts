'use client';

import { useCallback, useRef, useState } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import type { ContextTarget } from '@/components/admin/shared/CanvasContextMenu';
import { PALETTE_DRAG_MIME } from './NodePalette';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ALIGNMENT_TOLERANCE, visualCentre } from './funnel-board-config';
import type { FunnelStepType, FunnelShapeType } from '@/lib/supabase';
import type { PaletteItem } from '@/lib/types/funnel';

/**
 * Encapsulates all board-interaction callbacks:
 * - add helpers (palette click, right-click, drag-and-drop)
 * - context-menu state
 * - alignment guides while dragging
 * - confirm-before-bulk-delete
 * - node-click → open side drawer
 */
export function useFunnelBoardInteractions(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportCentre: () => { x: number; y: number },
) {
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();
  const confirm = useConfirm();

  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [guides, setGuides] = useState<{ horizontals: number[]; verticals: number[] }>(
    { horizontals: [], verticals: [] }
  );
  const rafRef = useRef<number>(0);

  /* ─── Add helpers (used by click-to-add palette + right-click + Cmd+D) ─── */

  const addStepAt = useCallback((stepType: FunnelStepType, flowX: number, flowY: number) => {
    void ctx.createStep(stepType, { x: flowX - 100, y: flowY - 100 });
  }, [ctx]);

  const addShapeAt = useCallback((shapeType: FunnelShapeType, flowX: number, flowY: number) => {
    const offsetX = shapeType === 'decision' ? 120 : 54;
    const offsetY = shapeType === 'decision' ? 120 : 70;
    void ctx.createShape({
      shape_type: shapeType,
      x: Math.round(flowX - offsetX), y: Math.round(flowY - offsetY),
      width: null, height: null, end_x: null, end_y: null,
      content: null,
      color: '#2B2B2B', stroke_width: 2, dashed: false,
      font_size: null,
    });
  }, [ctx]);

  const handlePickStep = useCallback((stepType: FunnelStepType) => {
    const c = viewportCentre();
    addStepAt(stepType, c.x, c.y);
  }, [addStepAt, viewportCentre]);

  const handlePickShape = useCallback((shapeType: FunnelShapeType) => {
    const c = viewportCentre();
    addShapeAt(shapeType, c.x, c.y);
  }, [addShapeAt, viewportCentre]);

  const handlePickSticky = useCallback(() => { void ctx.addNote(); }, [ctx]);

  /* ─── Drag-and-drop from palette to canvas ─── */

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(PALETTE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(PALETTE_DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    let item: PaletteItem;
    try { item = JSON.parse(raw) as PaletteItem; } catch { return; }
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (item.kind === 'step') {
      addStepAt(item.stepType, flowPos.x, flowPos.y);
    } else if (item.kind === 'shape') {
      addShapeAt(item.shapeType as FunnelShapeType, flowPos.x, flowPos.y);
    } else {
      void ctx.addNote({ x: flowPos.x - 100, y: flowPos.y - 75 });
    }
  }, [rf, ctx, addStepAt, addShapeAt]);

  /* ─── Right-click context menus ─── */

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    if (!node.selected) {
      rf.setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
    }
    setContextMenu({ kind: 'node', nodeId: node.id, clientX: e.clientX, clientY: e.clientY });
  }, [rf]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setContextMenu({
      kind: 'pane', clientX: e.clientX, clientY: e.clientY,
      flowX: flowPos.x, flowY: flowPos.y,
    });
  }, [rf]);

  /* ─── Confirm before bulk delete ─── */

  const onBeforeDelete = useCallback(async ({ nodes, edges }: { nodes: Node[]; edges: unknown[] }) => {
    if (nodes.length <= 1) return true;
    return confirm({
      title: `Delete ${nodes.length} items`,
      message: `Delete ${nodes.length} selected items? You can undo this with Cmd+Z.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
  }, [confirm]);

  /* ─── Smart alignment guides while dragging ─── */

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

  /* ─── Click → open the matching side drawer ─── */

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('step-'))       ctx.selectStep(node.id.slice(5));
    else if (node.id.startsWith('shape-')) ctx.selectShape(node.id.slice(6));
    else if (node.id.startsWith('note-'))  ctx.selectNote(node.id.slice(5));
  }, [ctx]);

  return {
    // Add helpers
    addStepAt,
    addShapeAt,
    handlePickStep,
    handlePickShape,
    handlePickSticky,
    // Drag-and-drop
    onDragOver,
    onDrop,
    // Context menu
    contextMenu,
    setContextMenu,
    onNodeContextMenu,
    onPaneContextMenu,
    // Bulk delete
    onBeforeDelete,
    // Alignment guides
    guides,
    onNodeDrag,
    onNodeDragStop,
    // Node click
    onNodeClick,
  };
}
