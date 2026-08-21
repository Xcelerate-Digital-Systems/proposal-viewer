'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant, useReactFlow,
  ConnectionMode, ConnectionLineType, type NodeTypes, type EdgeTypes, type Edge, type Connection, type Node, Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Undo2, Redo2, Wand2, SquareDashedBottom } from 'lucide-react';
import UndoHistoryPanel from '@/components/admin/shared/UndoHistoryPanel';
import { wouldCreateCycle } from '@/components/admin/shared/board-utils';
import { computeForecast } from '@/lib/funnel/forecast';
import { ForecastCtx } from './ForecastContext';
import BoardSummary from './BoardSummary';
import FunnelStepNode from './nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import NodePalette from './NodePalette';
import StepSideDrawer from './StepSideDrawer';
import ShapeSideDrawer from '@/components/admin/shared/board/ShapeSideDrawer';
import NoteSideDrawer from '@/components/admin/shared/board/NoteSideDrawer';
import ExportMenu from '@/components/admin/shared/ExportMenu';
import CanvasContextMenu from '@/components/admin/shared/CanvasContextMenu';
import AlignmentGuides from '@/components/admin/shared/AlignmentGuides';
import CombinedEdgePanel from './CombinedEdgePanel';
import SyncStatusPill from '@/components/admin/shared/SyncStatusPill';
import { defaultEdgeOptions } from './funnel-board-config';
import { useFunnelBoard } from './useFunnelBoard';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import { useFunnelBoardInteractions } from './useFunnelBoardInteractions';
import { useFunnelBoardClipboard } from './useFunnelBoardClipboard';
import BulkSelectionToolbar from '@/components/admin/shared/BulkSelectionToolbar';
import SectionNode from './nodes/SectionNode';
import SectionSideDrawer from './SectionSideDrawer';
import ViewAsRoleMenu from './ViewAsRoleMenu';

const nodeTypes: NodeTypes = {
  funnelStep: FunnelStepNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
  section: SectionNode,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

function FunnelBoardInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useFunnelBoardContextOrThrow();
  const rf = useReactFlow();

  const forecast = useMemo(
    () => computeForecast(
      ctx.steps, ctx.boardEdges,
      ctx.funnel?.forecast_period ?? 'total',
      ctx.funnel?.default_deal_value ?? null,
      ctx.shapes,
    ),
    [ctx.steps, ctx.boardEdges, ctx.shapes, ctx.funnel?.forecast_period, ctx.funnel?.default_deal_value]
  );

  const board = useFunnelBoard(forecast.flowByEdge);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const src = connection.source;
    const tgt = connection.target;
    if (!src || !tgt) return false;
    if (src === tgt) return false;
    if (board.edges.some((e) => e.source === src && e.target === tgt)) return false;
    if (wouldCreateCycle(board.edges, src, tgt)) return false;
    return true;
  }, [board.edges]);

  const viewportCentre = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

  const interactions = useFunnelBoardInteractions(containerRef, viewportCentre, {
    onConnect: board.onConnect,
    edges: board.edges,
    isValidConnection,
  });
  const clipboard = useFunnelBoardClipboard(viewportCentre);

  const minimapNodeColor = useCallback((node: Node) => {
    if (node.type === 'section') return 'rgba(1,124,135,0.08)';
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
  }, []);

  const minimapStrokeColor = useCallback(() => 'rgba(43,43,43,0.25)', []);

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
  const selectedSection =
    ctx.sections.find((s) => s.id === ctx.selectedSectionId) || null;

  // How many nodes each role owns, for the "View as" menu.
  const roleCounts = new Map<string, number>();
  for (const s of ctx.steps) if (s.role_id) roleCounts.set(s.role_id, (roleCounts.get(s.role_id) ?? 0) + 1);
  for (const sh of ctx.shapes) if (sh.role_id) roleCounts.set(sh.role_id, (roleCounts.get(sh.role_id) ?? 0) + 1);

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

  /* ── Draw a section ──────────────────────────────────────────────────────
   *  Arming the toolbar button turns the next drag on the canvas into a
   *  rectangle, rather than dropping a fixed box in the middle of the viewport
   *  and making the user resize it around the nodes it's meant to contain.
   *  Panning is suspended while armed so the drag draws instead of moving the
   *  canvas. */
  const [drawingSection, setDrawingSection] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawNow, setDrawNow] = useState<{ x: number; y: number } | null>(null);

  const MIN_SECTION = 60;

  useEffect(() => {
    if (!drawingSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingSection(false);
        setDrawStart(null);
        setDrawNow(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawingSection]);

  const onDrawMouseDown = (e: React.MouseEvent) => {
    if (!drawingSection || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = { x: e.clientX, y: e.clientY };
    setDrawStart(pt);
    setDrawNow(pt);
  };

  const onDrawMouseMove = (e: React.MouseEvent) => {
    if (!drawingSection || !drawStart) return;
    setDrawNow({ x: e.clientX, y: e.clientY });
  };

  const onDrawMouseUp = () => {
    if (!drawingSection || !drawStart || !drawNow) {
      setDrawStart(null); setDrawNow(null);
      return;
    }
    const a = rf.screenToFlowPosition(drawStart);
    const b = rf.screenToFlowPosition(drawNow);
    const x = Math.round(Math.min(a.x, b.x));
    const y = Math.round(Math.min(a.y, b.y));
    const width = Math.round(Math.abs(b.x - a.x));
    const height = Math.round(Math.abs(b.y - a.y));

    setDrawStart(null); setDrawNow(null); setDrawingSection(false);

    // A click rather than a drag — treat as a cancel, not a sliver of a section.
    if (width < MIN_SECTION || height < MIN_SECTION) return;

    void ctx.createSection({ label: 'Section', color: 'teal', x, y, width, height });
  };

  // Screen-space preview of the rectangle being dragged out.
  const drawPreview = drawStart && drawNow ? (() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      left: Math.min(drawStart.x, drawNow.x) - rect.left,
      top: Math.min(drawStart.y, drawNow.y) - rect.top,
      width: Math.abs(drawNow.x - drawStart.x),
      height: Math.abs(drawNow.y - drawStart.y),
    };
  })() : null;

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
        onMouseDownCapture={onDrawMouseDown}
        onMouseMove={onDrawMouseMove}
        onMouseUp={onDrawMouseUp}
        style={drawingSection ? { cursor: 'crosshair' } : undefined}
      >
        {/* Live preview of the section being dragged out. */}
        {drawPreview && (
          <div
            className="absolute z-20 pointer-events-none rounded-2xl border-2 border-dashed"
            style={{
              ...drawPreview,
              backgroundColor: 'rgba(1,124,135,0.06)',
              borderColor: 'rgba(1,124,135,0.5)',
            }}
          />
        )}
        {drawingSection && !drawStart && (
          <div className="absolute z-20 top-3 left-1/2 -translate-x-1/2 pointer-events-none bg-ink text-white text-2xs px-2.5 py-1 rounded-full shadow-sm">
            Drag to draw a section — Esc to cancel
          </div>
        )}
        <ReactFlow
          nodes={board.nodes}
          edges={board.edges}
          onNodesChange={board.onNodesChange}
          onEdgesChange={board.onEdgesChange}
          onConnect={board.onConnect}
          onReconnect={board.onReconnect}
          onEdgeClick={board.onEdgeClick}
          onNodeDragStart={board.onNodeDragStart}
          onNodeDrag={(e, n) => { board.onNodeDrag(e, n); interactions.onNodeDrag(e, n); }}
          onNodeDragStop={(e, n) => { board.onNodeDragStop(e, n); interactions.onNodeDragStop(e, n); }}
          onNodeClick={interactions.onNodeClick}
          onNodeContextMenu={interactions.onNodeContextMenu}
          onPaneContextMenu={interactions.onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.Straight}
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
          onlyRenderVisibleElements
          deleteKeyCode={['Backspace', 'Delete']}
          onBeforeDelete={interactions.onBeforeDelete}
          panOnDrag={drawingSection ? false : [0, 1]}
          selectionMode={SelectionMode.Partial}
          nodesDraggable={!drawingSection}
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
              else if (n.id.startsWith('section-')) ctx.deleteSection(n.id.replace('section-', ''));
            });
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(43,43,43,0.15)" />
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-edge !shadow-sm !rounded-lg"
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapStrokeColor}
            className="!bg-surface/80 !border !border-edge !rounded-xl !shadow-sm backdrop-blur-sm"
            style={{ width: 160, height: 100 }}
            zoomable
            pannable
            maskColor="rgba(0,0,0,0.06)"
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
                <button
                  type="button"
                  onClick={() => setDrawingSection((v) => !v)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    drawingSection
                      ? 'bg-teal text-white'
                      : 'text-ink/70 hover:text-ink hover:bg-surface'
                  }`}
                  title={drawingSection ? 'Click and drag on the canvas to draw the section (Esc to cancel)' : 'Draw a section'}
                >
                  <SquareDashedBottom size={14} />
                </button>
              </div>
              <ViewAsRoleMenu
                roles={ctx.roles}
                viewAsRoleId={ctx.viewAsRoleId}
                onChange={ctx.setViewAsRoleId}
                countsByRole={roleCounts}
              />
              <ExportMenu containerRef={containerRef} boardName={ctx.funnel?.name || 'funnel'} />
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
                onGroup={clipboard.groupSelected}
                onUngroup={clipboard.ungroupSelected}
                hasGroup={clipboard.hasGroupInSelection()}
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
            onPaste={interactions.contextMenu.kind === 'pane' ? clipboard.pasteAtViewport : undefined}
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
              funnelLink={{
                currentFunnelId: ctx.funnel!.id,
                linkedFunnelId: selectedShape.linked_funnel_id,
                onLink: (id) => ctx.updateShape(selectedShape.id, { linked_funnel_id: id, linked_tab_id: id ? null : selectedShape.linked_tab_id } as any),
                tabs: ctx.tabs,
                currentTabId: ctx.activeTabId,
                linkedTabId: selectedShape.linked_tab_id,
                onLinkTab: (id) => ctx.updateShape(selectedShape.id, { linked_tab_id: id, linked_funnel_id: id ? null : selectedShape.linked_funnel_id } as any),
              }}
              nodeMessage={{
                raw: selectedShape.message,
                onChange: (next) => ctx.updateShape(selectedShape.id, { message: next }),
              }}
              nodePlatform={{
                platform: selectedShape.platform,
                onChange: (slug) => ctx.updateShape(selectedShape.id, { platform: slug }),
              }}
              nodeRole={{
                roles: ctx.roles,
                roleId: selectedShape.role_id,
                onAssign: (id) => ctx.updateShape(selectedShape.id, { role_id: id }),
                onCreate: ctx.ensureRole,
                onRecolour: (id, color) => void ctx.updateRole(id, { color }),
              }}
            />
          )}

          {selectedSection && (
            <SectionSideDrawer
              key={`section-${selectedSection.id}`}
              section={selectedSection}
              onUpdate={(patch) => ctx.updateSection(selectedSection.id, patch)}
              onDelete={() => { ctx.deleteSection(selectedSection.id); ctx.selectSection(null); }}
              onClose={() => ctx.selectSection(null)}
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
              tabs={ctx.tabs}
              activeTabId={ctx.activeTabId}
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
