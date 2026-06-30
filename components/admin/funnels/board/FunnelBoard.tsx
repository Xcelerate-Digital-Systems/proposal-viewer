'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant, useReactFlow,
  ConnectionMode, type NodeTypes, type EdgeTypes, type Node, type Edge, type Connection, Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence } from 'framer-motion';
import { Loader2, MousePointer, Undo2, Redo2, Cloud, CloudOff } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { computeForecast, formatCount } from '@/lib/funnel/forecast';
import { ForecastCtx } from './ForecastContext';
import BoardSummary from './BoardSummary';
import FunnelStepNode from './nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import EdgeStyleEditor from '@/components/admin/feedback/board/EdgeStyleEditor';
import NodePalette, { PALETTE_DRAG_MIME } from './NodePalette';
import StepSideDrawer from './StepSideDrawer';
import ShapeSideDrawer from './ShapeSideDrawer';
import NoteSideDrawer from './NoteSideDrawer';
import EdgeSplitEditor from './EdgeSplitEditor';
import ExportMenu from './ExportMenu';
import CanvasContextMenu, { type ContextTarget } from './CanvasContextMenu';
import AlignmentGuides from './AlignmentGuides';
import { useFunnelBoard } from './useFunnelBoard';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import type { FunnelStep, FunnelStepType, FunnelShapeType, FunnelBoardEdge } from '@/lib/supabase';
import type { PaletteItem } from '@/lib/types/funnel';
import type { NewShape } from './FunnelBoardContext';

const nodeTypes: NodeTypes = {
  funnelStep: FunnelStepNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

const defaultEdgeOptions = {
  type: 'labeled',
  animated: false,
  style: { stroke: '#2B2B2B', strokeWidth: 1.8 },
};

const ALIGNMENT_TOLERANCE = 6; // flow-units; soft snap range while dragging

/** Visual centre of a node — used for alignment. Pages have their body
 *  centred at frame-Y=100 (200px page mockup, top of frame); disc step
 *  nodes are 88px and sit at the top of the frame so their centre is Y=44.
 *  Everything else uses the geometric centre of the measured frame. */
function visualCentre(n: Node): { cx: number; cy: number } {
  if (n.type === 'funnelStep') {
    const step = (n.data as { step?: { step_type?: string } } | undefined)?.step;
    const isPage = !!step?.step_type?.startsWith('page_');
    return {
      cx: n.position.x + 100,
      cy: n.position.y + (isPage ? 100 : 44),
    };
  }
  // RF v12 exposes measured size at n.measured; fall back to width/height
  // if unset (immediately after mount).
  const m = (n as unknown as { measured?: { width?: number; height?: number } }).measured;
  const w = m?.width ?? (n as { width?: number }).width ?? 100;
  const h = m?.height ?? (n as { height?: number }).height ?? 100;
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2 };
}

function FunnelBoardInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();
  const confirm = useConfirm();

  const forecast = useMemo(
    () => computeForecast(ctx.steps, ctx.boardEdges, ctx.funnel?.forecast_period ?? 'total', ctx.funnel?.default_deal_value ?? null),
    [ctx.steps, ctx.boardEdges, ctx.funnel?.forecast_period, ctx.funnel?.default_deal_value]
  );

  const board = useFunnelBoard(forecast.flowByEdge);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const src = connection.source;
    const tgt = connection.target;
    if (!src || !tgt) return false;
    if (src === tgt) return false;
    return !board.edges.some((e) => e.source === src && e.target === tgt);
  }, [board.edges]);

  type ClipboardEntry =
    | { kind: 'step'; stepType: FunnelStepType; label: string; icon: string | null; url: string | null; color: string | null; metrics: unknown }
    | { kind: 'shape'; data: Omit<NewShape, never> }
    | { kind: 'note'; content: string; color: string; width: number; height: number; font_size: number | null };
  const clipboardRef = useRef<ClipboardEntry[]>([]);
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [guides, setGuides] = useState<{ horizontals: number[]; verticals: number[] }>(
    { horizontals: [], verticals: [] }
  );

  const viewportCentre = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

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
      // Primitive shapes (rectangle/ellipse/arrow/line/text) use `color` as
      // their stroke — default to ink. Diamond-style shapes inherit their
      // colour from DIAMOND_CONFIG via the renderer, so we use the legacy
      // sentinel '#2B2B2B' here and the renderer treats it as "no override".
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
      // Sticky notes accept an optional position; drop at cursor minus a
      // rough half-size so the note centres on the click.
      void ctx.addNote({ x: flowPos.x - 100, y: flowPos.y - 75 });
    }
  }, [rf, ctx, addStepAt, addShapeAt]);

  /* ─── Right-click context menus ─── */

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    // Make sure the clicked node is selected so duplicate/delete operate on
    // it (and the existing multi-selection if it was part of one).
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

  /* ─── Duplicate selected nodes (Cmd+D + context-menu action) ─── */

  const duplicateSelected = useCallback(async () => {
    let selected = rf.getNodes().filter((n) => n.selected);
    // Fallback: if React Flow has no selection (e.g. user clicked a node which
    // only opened the side drawer), use the context-selected step/shape/note
    // so Cmd+D still duplicates the node the user is "working on".
    if (selected.length === 0) {
      const fallbackId = ctx.selectedStepId
        ? `step-${ctx.selectedStepId}`
        : ctx.selectedShapeId
        ? `shape-${ctx.selectedShapeId}`
        : ctx.selectedNoteId
        ? `note-${ctx.selectedNoteId}`
        : null;
      if (!fallbackId) return;
      const node = rf.getNodes().find((n) => n.id === fallbackId);
      if (!node) return;
      selected = [node];
    }
    for (const node of selected) {
      if (node.id.startsWith('step-')) {
        const origId = node.id.slice(5);
        const orig = ctx.steps.find((s) => s.id === origId);
        if (!orig) continue;
        const next = await ctx.createStep(orig.step_type, { x: orig.board_x + 40, y: orig.board_y + 40 });
        if (next) {
          await ctx.updateStep(next.id, {
            label: orig.label, icon: orig.icon, url: orig.url,
            color: orig.color, metrics: orig.metrics,
          });
        }
      } else if (node.id.startsWith('shape-')) {
        const origId = node.id.slice(6);
        const orig = ctx.shapes.find((s) => s.id === origId);
        if (!orig) continue;
        await ctx.createShape({
          shape_type: orig.shape_type,
          x: orig.x + 40, y: orig.y + 40,
          width: orig.width, height: orig.height,
          end_x: orig.end_x, end_y: orig.end_y,
          content: orig.content,
          color: orig.color, stroke_width: orig.stroke_width,
          dashed: orig.dashed, font_size: orig.font_size,
        });
      } else if (node.id.startsWith('note-')) {
        const origId = node.id.slice(5);
        const orig = ctx.boardNotes.find((n) => n.id === origId);
        if (!orig) continue;
        const next = await ctx.addNote({ x: orig.board_x + 40, y: orig.board_y + 40 });
        if (next) {
          await ctx.updateNote(next.id, {
            content: orig.content, color: orig.color,
            width: orig.width, height: orig.height, font_size: orig.font_size,
          });
        }
      }
    }
  }, [rf, ctx]);

  const deleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    for (const node of selected) {
      if (node.id.startsWith('note-'))       await ctx.deleteNote(node.id.slice(5));
      else if (node.id.startsWith('shape-')) await ctx.deleteShape(node.id.slice(6));
      else if (node.id.startsWith('step-'))  await ctx.deleteStep(node.id.slice(5));
    }
  }, [rf, ctx]);

  /* ─── Lock / unlock ─── */

  const toggleLockSelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const allLocked = selected.every((n) => lockedNodes.has(n.id));
    setLockedNodes((prev) => {
      const next = new Set(prev);
      for (const n of selected) {
        if (allLocked) next.delete(n.id); else next.add(n.id);
      }
      return next;
    });
  }, [rf, lockedNodes]);

  useEffect(() => {
    rf.setNodes((nds) => nds.map((n) => ({
      ...n,
      draggable: !lockedNodes.has(n.id),
      className: lockedNodes.has(n.id) ? 'opacity-80' : undefined,
    })));
  }, [lockedNodes, rf]);

  /* ─── Copy / paste ─── */

  const copySelected = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    const entries: ClipboardEntry[] = [];
    for (const node of selected) {
      if (node.id.startsWith('step-')) {
        const orig = ctx.steps.find((s) => s.id === node.id.slice(5));
        if (!orig) continue;
        entries.push({
          kind: 'step', stepType: orig.step_type,
          label: orig.label, icon: orig.icon, url: orig.url,
          color: orig.color, metrics: orig.metrics,
        });
      } else if (node.id.startsWith('shape-')) {
        const orig = ctx.shapes.find((s) => s.id === node.id.slice(6));
        if (!orig) continue;
        entries.push({
          kind: 'shape',
          data: {
            shape_type: orig.shape_type, x: orig.x, y: orig.y,
            width: orig.width, height: orig.height,
            end_x: orig.end_x, end_y: orig.end_y,
            content: orig.content, color: orig.color,
            stroke_width: orig.stroke_width, dashed: orig.dashed, font_size: orig.font_size,
          },
        });
      } else if (node.id.startsWith('note-')) {
        const orig = ctx.boardNotes.find((n) => n.id === node.id.slice(5));
        if (!orig) continue;
        entries.push({
          kind: 'note',
          content: orig.content || '', color: orig.color || '#FFF4B8',
          width: orig.width || 200, height: orig.height || 150,
          font_size: orig.font_size,
        });
      }
    }
    clipboardRef.current = entries;
  }, [rf, ctx]);

  const pasteAtViewport = useCallback(async () => {
    if (clipboardRef.current.length === 0) return;
    const c = viewportCentre();
    let offsetIdx = 0;
    for (const entry of clipboardRef.current) {
      const ox = 40 * offsetIdx;
      const oy = 40 * offsetIdx;
      if (entry.kind === 'step') {
        const next = await ctx.createStep(entry.stepType, { x: c.x + ox - 100, y: c.y + oy - 100 });
        if (next) await ctx.updateStep(next.id, { label: entry.label, icon: entry.icon, url: entry.url, color: entry.color, metrics: entry.metrics as FunnelStep['metrics'] });
      } else if (entry.kind === 'shape') {
        await ctx.createShape({ ...entry.data, x: c.x + ox - 100, y: c.y + oy - 100 });
      } else {
        const note = await ctx.addNote({ x: c.x + ox - 100, y: c.y + oy - 75 });
        if (note) await ctx.updateNote(note.id, { content: entry.content, color: entry.color, width: entry.width, height: entry.height, font_size: entry.font_size });
      }
      offsetIdx++;
    }
  }, [ctx, viewportCentre]);

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

  /* ─── Keyboard: Cmd-Z/Y undo+redo, Cmd-D duplicate ─── */

  useEffect(() => {
    const PAN_STEP = 50;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (tgt?.closest('[data-side-drawer]') || tgt?.closest('[role="dialog"]') || tgt?.closest('[role="listbox"]')) return;

      // Shift+Arrow: pan the canvas without a mouse
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const vp = rf.getViewport();
        const dx = e.key === 'ArrowLeft' ? PAN_STEP : e.key === 'ArrowRight' ? -PAN_STEP : 0;
        const dy = e.key === 'ArrowUp' ? PAN_STEP : e.key === 'ArrowDown' ? -PAN_STEP : 0;
        rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 120 });
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        copySelected();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        void pasteAtViewport();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) void ctx.redo(); else void ctx.undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        void ctx.redo();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        void duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx, duplicateSelected, copySelected, pasteAtViewport]);

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-faint" />
      </div>
    );
  }

  const boardEmpty =
    ctx.steps.length === 0 && ctx.boardNotes.length === 0 && ctx.shapes.length === 0;

  const selectedStep =
    ctx.steps.find((s) => s.id === ctx.selectedStepId) || null;
  const selectedShape =
    ctx.shapes.find((s) => s.id === ctx.selectedShapeId) || null;
  const selectedNote =
    ctx.boardNotes.find((n) => n.id === ctx.selectedNoteId) || null;

  const selectedDbEdge = board.selectedEdge
    ? ctx.boardEdges.find((e) => e.id === board.selectedEdge!.id) || null
    : null;

  const splitEditorContext = (() => {
    if (!selectedDbEdge || !selectedDbEdge.source_step_id || !selectedDbEdge.target_step_id) return null;
    const siblings = ctx.boardEdges.filter(
      (e) => e.id !== selectedDbEdge.id && e.source_step_id === selectedDbEdge.source_step_id
    );
    if (siblings.length === 0) return null;
    return { edge: selectedDbEdge, siblings, flowThrough: 0 };
  })();

  const selectionCount = rf.getNodes().filter((n) => n.selected).length;

  return (
    <ForecastCtx.Provider value={forecast}>
    <div className="flex h-full min-h-[400px] bg-white overflow-hidden">
      <NodePalette
        onPickStep={handlePickStep}
        onPickShape={handlePickShape}
        onPickSticky={handlePickSticky}
      />
      <div
        className="flex-1 relative"
        ref={containerRef}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <ReactFlow
          nodes={board.nodes}
          edges={board.edges}
          onNodesChange={board.onNodesChange}
          onEdgesChange={board.onEdgesChange}
          onConnect={board.onConnect}
          onReconnect={board.onReconnect}
          onEdgeClick={board.onEdgeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          isValidConnection={isValidConnection}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid
          snapGrid={[4, 4]}
          style={{ background: 'transparent' }}
          deleteKeyCode={['Backspace', 'Delete']}
          onBeforeDelete={onBeforeDelete}
          // Selection model (Funnelytics/Figma style): left-click drag on empty
          // pane pans the canvas. Hold Shift + drag for a selection box.
          // Middle-mouse also pans. Right-click is reserved for context menu.
          panOnDrag={[0, 1]}
          selectionMode={SelectionMode.Partial}
          panActivationKeyCode="Space"
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionKeyCode="Shift"
          onPaneClick={() => {
            if (board.selectedEdge) board.closeEdgeEditor();
            ctx.clearSelection();
          }}
          onEdgesDelete={(deleted) => deleted.forEach((e) => board.handleDeleteEdge(e.id))}
          onNodesDelete={(deleted) => {
            deleted.forEach((n) => {
              if (n.id.startsWith('note-')) ctx.deleteNote(n.id.replace('note-', ''));
              else if (n.id.startsWith('shape-')) ctx.deleteShape(n.id.replace('shape-', ''));
              else if (n.id.startsWith('step-')) ctx.deleteStep(n.id.replace('step-', ''));
            });
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(43,43,43,0.15)" />
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-edge !shadow-sm !rounded-lg"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'stickyNote') {
                const note = (node.data as Record<string, unknown>)?.note as { color?: string } | undefined;
                return note?.color || '#FDE68A';
              }
              if (node.type === 'shape') {
                const shape = (node.data as Record<string, unknown>)?.shape as { color?: string } | undefined;
                return shape?.color || 'rgba(43,43,43,0.4)';
              }
              const step = (node.data as Record<string, unknown>)?.step as { color?: string | null } | undefined;
              return step?.color || '#ffffff';
            }}
            nodeStrokeColor={() => 'rgba(43,43,43,0.3)'}
            className="!bg-surface !border !border-edge !rounded-lg"
            style={{ width: 140, height: 90 }}
            zoomable
            pannable
          />

          <Panel position="top-left">
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1 bg-white border border-edge shadow-sm rounded-lg px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => void ctx.undo()}
                  disabled={!ctx.canUndo}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={ctx.canUndo ? 'Undo (⌘Z)' : 'Nothing to undo'}
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void ctx.redo()}
                  disabled={!ctx.canRedo}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={ctx.canRedo ? 'Redo (⌘⇧Z)' : 'Nothing to redo'}
                >
                  <Redo2 size={14} />
                </button>
              </div>
              <ExportMenu containerRef={containerRef} funnelName={ctx.funnel?.name || 'funnel'} />
              <SyncStatusPill status={ctx.syncStatus} />
            </div>
          </Panel>

          {board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <CombinedEdgePanel
                edge={board.selectedEdge}
                onUpdateStyle={board.handleUpdateEdgeStyle}
                onDelete={() => board.handleDeleteEdge(board.selectedEdge!.id)}
                onClose={board.closeEdgeEditor}
                splitContext={splitEditorContext}
                onUpdateSplit={splitEditorContext ? (patch) => ctx.updateEdge(splitEditorContext.edge.id, patch) : undefined}
              />
            </Panel>
          )}

          {boardEmpty && !board.selectedEdge && (
            <Panel position="top-center" className="!top-20">
              <div className="bg-white rounded-lg border border-edge shadow-sm px-5 py-4 max-w-sm text-center">
                <p className="text-sm font-semibold text-ink mb-1">Empty canvas</p>
                <p className="text-detail text-muted leading-relaxed">
                  Drag a step from the palette, or right-click the canvas to add one. Connect steps to build your flow.
                </p>
                <div className="flex items-center justify-center gap-3 mt-2.5 text-2xs text-faint">
                  <span>⌘D duplicate</span>
                  <span>⌘Z undo</span>
                  <span>⇧ drag to select</span>
                </div>
              </div>
            </Panel>
          )}

          {ctx.steps.length > 0 && (
            <Panel position="bottom-center" className="!bottom-4">
              {forecast.totalRevenue > 0 || forecast.totalCost > 0 ? (
                <BoardSummary
                  forecast={forecast}
                  currency={ctx.funnel?.currency}
                  period={ctx.funnel?.forecast_period}
                />
              ) : (
                <div className="flex items-center gap-2 bg-white rounded-lg border border-edge shadow-sm px-3.5 py-2">
                  <span className="text-detail text-muted">
                    Click a step and enter forecast metrics to see projections here
                  </span>
                </div>
              )}
            </Panel>
          )}
        </ReactFlow>

        <AlignmentGuides horizontals={guides.horizontals} verticals={guides.verticals} />

        {contextMenu && (
          <CanvasContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            selectionCount={selectionCount}
            onPasteAt={contextMenu.kind === 'pane' ? pasteAtViewport : undefined}
            canPaste={clipboardRef.current.length > 0}
            onAddStep={contextMenu.kind === 'pane' ? () => {
              if (contextMenu.kind === 'pane') addStepAt('generic', contextMenu.flowX, contextMenu.flowY);
            } : undefined}
            onDuplicate={contextMenu.kind === 'node' ? duplicateSelected : undefined}
            onDelete={contextMenu.kind === 'node' ? deleteSelected : undefined}
            onLockToggle={contextMenu.kind === 'node' ? toggleLockSelected : undefined}
            isLocked={contextMenu.kind === 'node' ? lockedNodes.has(contextMenu.nodeId) : false}
            onEdit={contextMenu.kind === 'node' ? () => {
              if (contextMenu.kind !== 'node') return;
              if (contextMenu.nodeId.startsWith('step-')) {
                ctx.selectStep(contextMenu.nodeId.slice(5));
              }
            } : undefined}
          />
        )}

        <AnimatePresence>
          {selectedShape && (
            <ShapeSideDrawer
              key={`shape-${selectedShape.id}`}
              shape={selectedShape}
              onUpdate={(patch) => ctx.updateShape(selectedShape.id, patch)}
              onDelete={() => { ctx.deleteShape(selectedShape.id); ctx.selectShape(null); }}
              onClose={() => ctx.selectShape(null)}
            />
          )}

          {selectedNote && (
            <NoteSideDrawer
              key={`note-${selectedNote.id}`}
              note={selectedNote}
              onUpdate={(patch) => ctx.updateNote(selectedNote.id, patch)}
              onDelete={() => { ctx.deleteNote(selectedNote.id); ctx.selectNote(null); }}
              onClose={() => ctx.selectNote(null)}
            />
          )}

          {selectedStep && (
            <StepSideDrawer
              key={`step-${selectedStep.id}`}
              step={selectedStep}
              onUpdate={(patch) => ctx.updateStep(selectedStep.id, patch)}
              onDelete={() => ctx.deleteStep(selectedStep.id)}
              onClose={() => ctx.selectStep(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
    </ForecastCtx.Provider>
  );
}

function CombinedEdgePanel({
  edge, onUpdateStyle, onDelete, onClose, splitContext, onUpdateSplit,
}: {
  edge: Edge;
  onUpdateStyle: (edgeId: string, patch: Record<string, unknown>) => void | Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  splitContext: { edge: FunnelBoardEdge; siblings: FunnelBoardEdge[]; flowThrough: number } | null;
  onUpdateSplit?: (patch: Partial<FunnelBoardEdge>) => void;
}) {
  const [tab, setTab] = useState<'style' | 'split'>('style');
  const hasSplit = !!splitContext;
  return (
    <div className="flex flex-col items-center">
      {hasSplit && (
        <div className="flex items-center gap-0.5 bg-white rounded-t-lg border border-b-0 border-edge px-1 pt-1">
          <button
            type="button"
            onClick={() => setTab('style')}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors ${
              tab === 'style' ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
            }`}
          >Style</button>
          <button
            type="button"
            onClick={() => setTab('split')}
            className={`px-2.5 py-1 text-2xs font-medium rounded-md transition-colors ${
              tab === 'split' ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
            }`}
          >Split</button>
        </div>
      )}
      {tab === 'style' ? (
        <EdgeStyleEditor edge={edge} onUpdate={onUpdateStyle} onDelete={onDelete} onClose={onClose} />
      ) : splitContext && onUpdateSplit ? (
        <EdgeSplitEditor
          edge={splitContext.edge}
          siblings={splitContext.siblings}
          flowThrough={splitContext.flowThrough}
          onUpdate={onUpdateSplit}
        />
      ) : null}
    </div>
  );
}

function SyncStatusPill({ status }: { status: 'idle' | 'saving' | 'error' }) {
  if (status === 'idle') return null;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-medium border shadow-sm ${
      status === 'saving'
        ? 'bg-white border-edge text-muted'
        : 'bg-red-50 border-red-200 text-red-600'
    }`}>
      {status === 'saving' ? (
        <>
          <Cloud size={12} className="animate-pulse" />
          <span>Saving…</span>
        </>
      ) : (
        <>
          <CloudOff size={12} />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}

export default function FunnelBoard() {
  return (
    <ReactFlowProvider>
      <FunnelBoardInner />
    </ReactFlowProvider>
  );
}
