'use client';

import { useRef, useCallback, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant, useReactFlow,
  ConnectionMode, type NodeTypes, type EdgeTypes, type Edge, type Connection, Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Undo2, Redo2, Wand2 } from 'lucide-react';
import UndoHistoryPanel from '@/components/admin/shared/UndoHistoryPanel';
import { computeForecast } from '@/lib/funnel/forecast';
import { ForecastCtx } from './ForecastContext';
import BoardSummary from './BoardSummary';
import FunnelStepNode from './nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import NodePalette from './NodePalette';
import StepSideDrawer from './StepSideDrawer';
import ShapeSideDrawer from './ShapeSideDrawer';
import NoteSideDrawer from './NoteSideDrawer';
import ExportMenu from './ExportMenu';
import CanvasContextMenu from './CanvasContextMenu';
import AlignmentGuides from './AlignmentGuides';
import CombinedEdgePanel from './CombinedEdgePanel';
import SyncStatusPill from './SyncStatusPill';
import { defaultEdgeOptions } from './funnel-board-config';
import { useFunnelBoard } from './useFunnelBoard';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import { useFunnelBoardInteractions } from './useFunnelBoardInteractions';
import { useFunnelBoardClipboard } from './useFunnelBoardClipboard';
import BulkSelectionToolbar from '@/components/admin/shared/BulkSelectionToolbar';

const nodeTypes: NodeTypes = {
  funnelStep: FunnelStepNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

function FunnelBoardInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();

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

  const viewportCentre = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

  const interactions = useFunnelBoardInteractions(containerRef, viewportCentre);
  const clipboard = useFunnelBoardClipboard(viewportCentre);

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
        onPickStep={interactions.handlePickStep}
        onPickShape={interactions.handlePickShape}
        onPickSticky={interactions.handlePickSticky}
      />
      <div
        className="flex-1 relative"
        ref={containerRef}
        onDragOver={interactions.onDragOver}
        onDrop={interactions.onDrop}
      >
        <ReactFlow
          nodes={board.nodes}
          edges={board.edges}
          onNodesChange={board.onNodesChange}
          onEdgesChange={board.onEdgesChange}
          onConnect={board.onConnect}
          onReconnect={board.onReconnect}
          onEdgeClick={board.onEdgeClick}
          onNodeDrag={interactions.onNodeDrag}
          onNodeDragStop={interactions.onNodeDragStop}
          onNodeClick={interactions.onNodeClick}
          onNodeContextMenu={interactions.onNodeContextMenu}
          onPaneContextMenu={interactions.onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          connectOnClick
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
          onBeforeDelete={interactions.onBeforeDelete}
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
                <UndoHistoryPanel
                  undoLabels={ctx.undoLabels}
                  redoLabels={ctx.redoLabels}
                  canUndo={ctx.canUndo}
                  canRedo={ctx.canRedo}
                  onUndo={() => void ctx.undo()}
                  onRedo={() => void ctx.redo()}
                />
                <div className="w-px h-5 bg-edge" />
                <button
                  type="button"
                  onClick={() => clipboard.tidyLayout('LR')}
                  disabled={ctx.steps.length + ctx.boardNotes.length + ctx.shapes.length < 2}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Auto-layout (tidy)"
                >
                  <Wand2 size={14} />
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

          {selectionCount >= 2 && !board.selectedEdge && (
            <Panel position="top-right">
              <BulkSelectionToolbar
                count={selectionCount}
                onAlignH={clipboard.alignH}
                onAlignV={clipboard.alignV}
                onDistributeH={clipboard.distributeH}
                onDistributeV={clipboard.distributeV}
                onDelete={clipboard.deleteSelected}
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
                <div className="flex items-center justify-center gap-3 mt-2.5 text-2xs text-faint flex-wrap">
                  <span>⌘D duplicate</span>
                  <span>⌘Z undo</span>
                  <span>⇧ drag to select</span>
                  <span>⌘1 fit all</span>
                  <span>← → nudge</span>
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

        <AlignmentGuides horizontals={interactions.guides.horizontals} verticals={interactions.guides.verticals} />

        {interactions.contextMenu && (
          <CanvasContextMenu
            target={interactions.contextMenu}
            onClose={() => interactions.setContextMenu(null)}
            selectionCount={selectionCount}
            onPasteAt={interactions.contextMenu.kind === 'pane' ? clipboard.pasteAtViewport : undefined}
            canPaste={clipboard.clipboardRef.current.length > 0}
            onAddStep={interactions.contextMenu.kind === 'pane' ? () => {
              if (interactions.contextMenu!.kind === 'pane') interactions.addStepAt('generic', interactions.contextMenu!.flowX, interactions.contextMenu!.flowY);
            } : undefined}
            onDuplicate={interactions.contextMenu.kind === 'node' ? clipboard.duplicateSelected : undefined}
            onDelete={interactions.contextMenu.kind === 'node' ? clipboard.deleteSelected : undefined}
            onLockToggle={interactions.contextMenu.kind === 'node' ? clipboard.toggleLockSelected : undefined}
            isLocked={interactions.contextMenu.kind === 'node' ? clipboard.lockedNodes.has(interactions.contextMenu.nodeId) : false}
            onEdit={interactions.contextMenu.kind === 'node' ? () => {
              if (interactions.contextMenu?.kind !== 'node') return;
              if (interactions.contextMenu.nodeId.startsWith('step-')) {
                ctx.selectStep(interactions.contextMenu.nodeId.slice(5));
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

export default function FunnelBoard() {
  return (
    <ReactFlowProvider>
      <FunnelBoardInner />
    </ReactFlowProvider>
  );
}
