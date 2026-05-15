'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, useReactFlow,
  ConnectionMode, type NodeTypes, type EdgeTypes, type Node, MarkerType, Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, MousePointer, Undo2, Redo2 } from 'lucide-react';
import FunnelStepNode from './nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import EdgeStyleEditor from '@/components/admin/feedback/board/EdgeStyleEditor';
import NodePalette, { PALETTE_DRAG_MIME } from './NodePalette';
import StepSideDrawer from './StepSideDrawer';
import BoardSummary from './BoardSummary';
import EdgeSplitEditor from './EdgeSplitEditor';
import ExportMenu from './ExportMenu';
import CanvasContextMenu, { type ContextTarget } from './CanvasContextMenu';
import AlignmentGuides from './AlignmentGuides';
import { useFunnelBoard } from './useFunnelBoard';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import type { FunnelStepType, FunnelShapeType } from '@/lib/supabase';
import type { PaletteItem } from '@/lib/types/funnel';

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
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2B2B2B', width: 16, height: 16 },
};

const ALIGNMENT_TOLERANCE = 6; // flow-units; soft snap range while dragging

/** Visual centre of a node — used for alignment. Step nodes have their
 *  visual centre at frame-offset (120, 100); diamonds/notes/cards use the
 *  geometric centre of their measured frame. */
function visualCentre(n: Node): { cx: number; cy: number } {
  if (n.type === 'funnelStep') {
    return { cx: n.position.x + 120, cy: n.position.y + 100 };
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

  const board = useFunnelBoard();

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
    void ctx.createStep(stepType, { x: flowX - 120, y: flowY - 100 });
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
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
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

  /* ─── Smart alignment guides while dragging ─── */

  const onNodeDrag = useCallback((_e: React.MouseEvent, node: Node) => {
    const others = rf.getNodes().filter((n) => n.id !== node.id && !n.selected);
    const drag = visualCentre(node);
    const hSet = new Set<number>();
    const vSet = new Set<number>();
    for (const o of others) {
      const oc = visualCentre(o);
      if (Math.abs(oc.cy - drag.cy) <= ALIGNMENT_TOLERANCE) hSet.add(Math.round(oc.cy));
      if (Math.abs(oc.cx - drag.cx) <= ALIGNMENT_TOLERANCE) vSet.add(Math.round(oc.cx));
    }
    setGuides({ horizontals: Array.from(hSet), verticals: Array.from(vSet) });
  }, [rf]);

  const onNodeDragStop = useCallback(() => {
    setGuides({ horizontals: [], verticals: [] });
  }, []);

  /* ─── Keyboard: Cmd-Z/Y undo+redo, Cmd-D duplicate ─── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
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
  }, [ctx, duplicateSelected]);

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const boardEmpty =
    ctx.steps.length === 0 && ctx.boardNotes.length === 0 && ctx.shapes.length === 0;

  const selectedStep =
    ctx.steps.find((s) => s.id === ctx.selectedStepId) || null;

  const selectedDbEdge = board.selectedEdge
    ? ctx.boardEdges.find((e) => e.id === board.selectedEdge!.id) || null
    : null;

  const splitEditorContext = (() => {
    if (!selectedDbEdge || !selectedDbEdge.source_step_id || !selectedDbEdge.target_step_id) return null;
    const siblings = ctx.boardEdges.filter(
      (e) => e.id !== selectedDbEdge.id && e.source_step_id === selectedDbEdge.source_step_id
    );
    if (siblings.length === 0) return null;
    const flowThrough = ctx.forecast.flowByEdge.get(selectedDbEdge.id) ?? 0;
    return { edge: selectedDbEdge, siblings, flowThrough };
  })();

  const selectionCount = rf.getNodes().filter((n) => n.selected).length;

  return (
    <div className="flex h-full min-h-[400px] bg-white rounded-xl border border-edge overflow-hidden shadow-sm">
      <NodePalette
        onPickStep={handlePickStep}
        onPickShape={handlePickShape}
        onPickSticky={handlePickSticky}
      />
      <div
        className="flex-1 relative bg-notebook"
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
          onEdgeClick={board.onEdgeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid
          snapGrid={[20, 20]}
          style={{ background: 'transparent' }}
          deleteKeyCode={['Backspace', 'Delete']}
          // Selection model: left-click empty space → drag selection box.
          // Pan with middle-mouse or hold space + left-click. Right-click
          // is reserved for the context menu.
          panOnDrag={[1]}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panActivationKeyCode="Space"
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionKeyCode={null}
          onPaneClick={() => {
            if (board.selectedEdge) board.closeEdgeEditor();
            if (ctx.selectedStepId) ctx.selectStep(null);
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
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-edge !shadow-sm !rounded-lg"
          />
          <MiniMap
            nodeClassName={(node) => {
              if (node.type === 'stickyNote') return 'fill-sticky-yellow';
              if (node.type === 'shape') return 'fill-ink/40';
              return 'fill-white stroke-ink/40';
            }}
            className="!bg-surface !border !border-edge !rounded-lg"
            style={{ width: 140, height: 90 }}
            zoomable
            pannable
          />

          <Panel position="top-left">
            <div className="flex items-start gap-2">
              <BoardSummary
                forecast={ctx.forecast}
                showMetrics={ctx.showMetrics}
                onToggleMetrics={() => ctx.setShowMetrics(!ctx.showMetrics)}
              />
              <div className="flex items-center gap-1 bg-white border border-edge shadow-sm rounded-lg px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => void ctx.undo()}
                  disabled={!ctx.canUndo}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo (⌘Z)"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void ctx.redo()}
                  disabled={!ctx.canRedo}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Redo (⌘⇧Z)"
                >
                  <Redo2 size={14} />
                </button>
              </div>
              <ExportMenu containerRef={containerRef} funnelName={ctx.funnel?.name || 'funnel'} />
            </div>
          </Panel>

          {board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <div className="flex flex-col items-center gap-2">
                <EdgeStyleEditor
                  edge={board.selectedEdge}
                  onUpdate={board.handleUpdateEdgeStyle}
                  onDelete={() => board.handleDeleteEdge(board.selectedEdge!.id)}
                  onClose={board.closeEdgeEditor}
                />
                {splitEditorContext && (
                  <EdgeSplitEditor
                    edge={splitEditorContext.edge}
                    siblings={splitEditorContext.siblings}
                    flowThrough={splitEditorContext.flowThrough}
                    onUpdate={(patch) => ctx.updateEdge(splitEditorContext.edge.id, patch)}
                  />
                )}
              </div>
            </Panel>
          )}

          {boardEmpty && !board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <div className="bg-white rounded-xl border border-edge shadow-lg px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-teal" />
                </div>
                <p className="text-base font-semibold text-ink mb-1">Start your funnel</p>
                <p className="text-xs text-muted">
                  Drag a step from the left onto the canvas, then connect them to show the flow.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        <AlignmentGuides horizontals={guides.horizontals} verticals={guides.verticals} />

        {contextMenu && (
          <CanvasContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            selectionCount={selectionCount}
            onAddStep={contextMenu.kind === 'pane' ? () => {
              if (contextMenu.kind === 'pane') addStepAt('generic', contextMenu.flowX, contextMenu.flowY);
            } : undefined}
            onDuplicate={contextMenu.kind === 'node' ? duplicateSelected : undefined}
            onDelete={contextMenu.kind === 'node' ? deleteSelected : undefined}
            onEdit={contextMenu.kind === 'node' ? () => {
              if (contextMenu.kind !== 'node') return;
              if (contextMenu.nodeId.startsWith('step-')) {
                ctx.selectStep(contextMenu.nodeId.slice(5));
              }
            } : undefined}
          />
        )}

        {selectedStep && (
          <StepSideDrawer
            step={selectedStep}
            forecastVisitors={ctx.forecast.visitorsByStep.get(selectedStep.id) ?? 0}
            forecastConversions={ctx.forecast.conversionsByStep.get(selectedStep.id) ?? 0}
            forecastRevenue={(ctx.forecast.conversionsByStep.get(selectedStep.id) ?? 0) * (selectedStep.metrics?.value ?? 0)}
            forecastCost={
              selectedStep.step_type.startsWith('traffic_')
                ? (ctx.forecast.visitorsByStep.get(selectedStep.id) ?? 0) * (selectedStep.metrics?.cost ?? 0)
                : (ctx.forecast.conversionsByStep.get(selectedStep.id) ?? 0) * (selectedStep.metrics?.cost ?? 0)
            }
            onUpdate={(patch) => ctx.updateStep(selectedStep.id, patch)}
            onDelete={() => ctx.deleteStep(selectedStep.id)}
            onClose={() => ctx.selectStep(null)}
          />
        )}
      </div>
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
