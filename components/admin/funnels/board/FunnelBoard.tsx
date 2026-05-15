'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, useReactFlow,
  ConnectionMode, type NodeTypes, type EdgeTypes, MarkerType, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, MousePointer, Undo2, Redo2 } from 'lucide-react';
import FunnelStepNode from './nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import EdgeStyleEditor from '@/components/admin/feedback/board/EdgeStyleEditor';
import NodePalette from './NodePalette';
import StepSideDrawer from './StepSideDrawer';
import BoardSummary from './BoardSummary';
import EdgeSplitEditor from './EdgeSplitEditor';
import ExportMenu from './ExportMenu';
import { useFunnelBoard } from './useFunnelBoard';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import type { FunnelStepType, FunnelShapeType } from '@/lib/supabase';

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

function FunnelBoardInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();

  const board = useFunnelBoard();

  const viewportCentre = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

  const handlePickStep = useCallback((stepType: FunnelStepType) => {
    const c = viewportCentre();
    // FRAME_W=240; centre the visual on the drop point. Pages are taller so
    // bias their Y a bit higher.
    const offsetY = stepType.startsWith('page_') ? 128 : 72;
    void ctx.createStep(stepType, { x: c.x - 120, y: c.y - offsetY });
  }, [ctx, viewportCentre]);

  const handlePickShape = useCallback((shapeType: FunnelShapeType) => {
    const c = viewportCentre();
    const offsetX = shapeType === 'decision' ? 120 : 54;
    const offsetY = shapeType === 'decision' ? 120 : 70;
    void ctx.createShape({
      shape_type: shapeType,
      x: Math.round(c.x - offsetX), y: Math.round(c.y - offsetY),
      width: null, height: null, end_x: null, end_y: null,
      content: null,
      color: '#2B2B2B', stroke_width: 2, dashed: false,
      font_size: null,
    });
  }, [ctx, viewportCentre]);

  const handlePickSticky = useCallback(() => { void ctx.addNote(); }, [ctx]);

  // Keyboard shortcuts — Cmd/Ctrl-Z undo, Cmd/Ctrl-Shift-Z (or Cmd-Y) redo.
  // Suppressed when an input/textarea is focused so it doesn't fight the
  // browser's native undo in form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) void ctx.redo();
        else void ctx.undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        void ctx.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx]);

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const boardEmpty =
    ctx.steps.length === 0 && ctx.boardNotes.length === 0 && ctx.shapes.length === 0;

  const selectedStep = useMemo(
    () => ctx.steps.find((s) => s.id === ctx.selectedStepId) || null,
    [ctx.steps, ctx.selectedStepId]
  );

  // Look up the underlying DB edge for the selected RF edge so we can edit
  // funnel-specific fields (split %) that aren't carried in the RF edge data.
  const selectedDbEdge = useMemo(() => {
    if (!board.selectedEdge) return null;
    return ctx.boardEdges.find((e) => e.id === board.selectedEdge!.id) || null;
  }, [board.selectedEdge, ctx.boardEdges]);

  const splitEditorContext = useMemo(() => {
    if (!selectedDbEdge || !selectedDbEdge.source_step_id || !selectedDbEdge.target_step_id) return null;
    const siblings = ctx.boardEdges.filter(
      (e) => e.id !== selectedDbEdge.id && e.source_step_id === selectedDbEdge.source_step_id
    );
    if (siblings.length === 0) return null; // single outgoing edge — no split needed
    const flowThrough = ctx.forecast.flowByEdge.get(selectedDbEdge.id) ?? 0;
    return { edge: selectedDbEdge, siblings, flowThrough };
  }, [selectedDbEdge, ctx.boardEdges, ctx.forecast]);

  return (
    <div className="flex h-full min-h-[400px] bg-white rounded-xl border border-edge overflow-hidden shadow-sm">
      <NodePalette
        onPickStep={handlePickStep}
        onPickShape={handlePickShape}
        onPickSticky={handlePickSticky}
      />
      <div className="flex-1 relative bg-notebook" ref={containerRef}>
        <ReactFlow
          nodes={board.nodes}
          edges={board.edges}
          onNodesChange={board.onNodesChange}
          onEdgesChange={board.onEdgesChange}
          onConnect={board.onConnect}
          onEdgeClick={board.onEdgeClick}
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
                  Pick a step from the left to drop it on the canvas, then drag and connect to map the flow.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

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
