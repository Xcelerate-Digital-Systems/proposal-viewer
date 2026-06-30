'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  ConnectionMode,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Connection,
  Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence } from 'framer-motion';
import { Loader2, MousePointer, Undo2, Redo2, Wand2 } from 'lucide-react';
import UndoHistoryPanel from '@/components/admin/shared/UndoHistoryPanel';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import FeedbackItemNode from './nodes/FeedbackItemNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import ShapeNode from './nodes/ShapeNode';
import LabeledEdge from './edges/LabeledEdge';
import EdgeStyleEditor from './EdgeStyleEditor';
import { type BoardTool } from './BoardTopToolbar';
import FeedbackPalette from './FeedbackPalette';
import CanvasContextMenu from './CanvasContextMenu';
import AlignmentGuides from './AlignmentGuides';
import ShapeSideDrawer from './ShapeSideDrawer';
import NoteSideDrawer from './NoteSideDrawer';
import ItemSideDrawer from './ItemSideDrawer';
import ExportMenu from './ExportMenu';
import { useFeedbackBoard } from './useFeedbackBoard';
import { useFeedbackBoardContextOrThrow } from './FeedbackBoardContext';
import { defaultEdgeOptions } from './feedback-board-config';
import { useFeedbackBoardInteractions } from './useFeedbackBoardInteractions';
import { useFeedbackBoardClipboard } from './useFeedbackBoardClipboard';
import FeedbackSyncStatusPill from './FeedbackSyncStatusPill';
import ShortcutHelpButton from './ShortcutHelpButton';
import BulkSelectionToolbar from '@/components/admin/shared/BulkSelectionToolbar';

interface Props {
  onNavigateToItem: (itemId: string) => void;
}

const nodeTypes: NodeTypes = {
  reviewItem: FeedbackItemNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

function FeedbackBoardInner({ onNavigateToItem }: Props) {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const ctx = useFeedbackBoardContextOrThrow();
  const rf = useReactFlow();
  const confirm = useConfirm();
  const [activeTool, setActiveTool] = useState<BoardTool>('select');

  const board = useFeedbackBoard({ onNavigateToItem });

  const viewportCentre = useCallback(() => {
    const container = reactFlowRef.current;
    const rect = container?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

  const interactions = useFeedbackBoardInteractions(reactFlowRef, viewportCentre, activeTool, setActiveTool);
  const clipboard = useFeedbackBoardClipboard(viewportCentre);

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const src = connection.source;
    const tgt = connection.target;
    if (!src || !tgt) return false;
    if (src === tgt) return false;
    return !board.edges.some((e) => e.source === src && e.target === tgt);
  }, [board.edges]);

  /* ── Keyboard shortcuts ────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (tgt?.closest('[data-side-drawer]') || tgt?.closest('[role="dialog"]') || tgt?.closest('[role="listbox"]')) return;
      // Arrow keys without modifier: nudge selected nodes
      const mod = e.metaKey || e.ctrlKey;
      if (!mod && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selected = rf.getNodes().filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          const step = e.altKey ? 1 : 10;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          rf.setNodes((nds) => nds.map((n) => {
            if (!n.selected) return n;
            return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
          }));
          for (const n of selected) {
            const nx = n.position.x + dx;
            const ny = n.position.y + dy;
            if (n.id.startsWith('note-')) void ctx.updateNote(n.id.slice(5), { board_x: nx, board_y: ny });
            else if (n.id.startsWith('shape-')) void ctx.updateShape(n.id.slice(6), { x: nx, y: ny });
            else void ctx.updateItemBoardPosition(n.id, nx, ny);
          }
          return;
        }
      }

      if (mod) {
        if (e.key === '1') {
          e.preventDefault();
          rf.fitView({ duration: 300, padding: 0.2 });
        } else if (e.key === '0') {
          e.preventDefault();
          const selected = rf.getNodes().filter((n) => n.selected);
          if (selected.length > 0) rf.fitView({ duration: 300, padding: 0.3, nodes: selected });
          else rf.fitView({ duration: 300, padding: 0.2 });
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          clipboard.copySelected();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          void clipboard.pasteAtViewport();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          void clipboard.duplicateSelected();
        } else if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) void ctx.redo?.(); else void ctx.undo?.();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          void ctx.redo?.();
        }
        return;
      }

      // Single-key tool shortcuts (matching toolbar labels)
      const toolMap: Record<string, BoardTool> = {
        v: 'select', r: 'rectangle', o: 'ellipse', a: 'arrow',
        l: 'line', t: 'text', n: 'sticky',
        d: 'decision', w: 'wait', g: 'goal', c: 'call',
        m: 'meeting', z: 'automation',
      };
      const tool = toolMap[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        if (tool === 'sticky') {
          interactions.handlePickSticky();
        } else if (tool === 'decision' || tool === 'wait' || tool === 'goal' || tool === 'call' || tool === 'meeting' || tool === 'automation') {
          interactions.handlePickShape(tool);
        } else {
          setActiveTool(tool);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipboard, ctx, rf, interactions, setActiveTool]);

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-faint" />
      </div>
    );
  }

  const cursorClass = interactions.isDrawingTool || interactions.isTextTool ? 'cursor-crosshair' : '';
  const boardEmpty =
    ctx.placedItems.length === 0 &&
    ctx.boardNotes.length === 0 &&
    ctx.shapes.length === 0;

  const selectionCount = rf.getNodes().filter((n) => n.selected).length;

  return (
    <div className="flex h-full min-h-[400px] bg-white rounded-2xl border border-edge overflow-hidden shadow-sm">
      <FeedbackPalette
        activeTool={activeTool}
        onPickShape={interactions.handlePickShape}
        onPickTool={interactions.handlePickTool}
        onPickSticky={interactions.handlePickSticky}
        getViewportCentre={viewportCentre}
      />
      <div
        className={`flex-1 relative ${cursorClass}`}
        ref={reactFlowRef}
        onMouseDown={interactions.onContainerMouseDown}
        onMouseMove={interactions.onContainerMouseMove}
        onMouseUp={interactions.onContainerMouseUp}
        onDragOver={interactions.onPaletteDragOver}
        onDrop={interactions.onPaletteDrop}
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
          snapGrid={[20, 20]}
          style={{ background: 'transparent' }}
          deleteKeyCode={['Backspace', 'Delete']}
          // Selection model (Figma/Funnelytics-style) only when the Select
          // tool is active. Drawing/text modes get their own pane handling.
          panOnDrag={interactions.isSelectTool ? [0, 1] : false}
          selectionMode={SelectionMode.Partial}
          panActivationKeyCode="Space"
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionKeyCode={interactions.isSelectTool ? 'Shift' : null}
          nodesDraggable={!interactions.isDrawingTool}
          nodesConnectable={!interactions.isDrawingTool}
          elementsSelectable={!interactions.isDrawingTool}
          onPaneClick={(e) => {
            if (interactions.isTextTool) interactions.onPaneClickForText(e);
            else if (board.selectedEdge) board.closeEdgeEditor();
            interactions.clearDrawerSelection();
          }}
          onBeforeDelete={async ({ nodes }) => {
            if (nodes.length === 0) return true;
            const label = nodes.length === 1
              ? `Delete this ${nodes[0]?.type === 'stickyNote' ? 'note' : nodes[0]?.type === 'feedbackItem' ? 'item' : 'shape'}?`
              : `Delete ${nodes.length} selected items? Connected edges will also be removed.`;
            return confirm({
              message: label,
              destructive: true,
              confirmLabel: nodes.length === 1 ? 'Delete' : `Delete ${nodes.length} items`,
            });
          }}
          onEdgesDelete={(deletedEdges) => {
            deletedEdges.forEach((e) => board.handleDeleteEdge(e.id));
          }}
          onNodesDelete={(deletedNodes) => {
            deletedNodes.forEach((n) => {
              if (n.id.startsWith('note-')) {
                ctx.deleteNote(n.id.replace('note-', ''));
              } else if (n.id.startsWith('shape-')) {
                ctx.deleteShape(n.id.replace('shape-', ''));
              } else {
                ctx.removeItemFromBoard(n.id);
              }
            });
          }}
        >
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-edge !shadow-sm !rounded-lg"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'stickyNote') {
                const color = (node.data as Record<string, unknown>)?.note as { color?: string } | undefined;
                return color?.color || '#FDE68A';
              }
              if (node.type === 'shape') {
                const shape = (node.data as Record<string, unknown>)?.shape as { color?: string } | undefined;
                return shape?.color || 'rgba(43,43,43,0.4)';
              }
              const item = (node.data as Record<string, unknown>)?.item as { board_color?: string | null } | undefined;
              return item?.board_color || '#ffffff';
            }}
            nodeStrokeColor={() => 'rgba(43,43,43,0.3)'}
            className="!bg-surface !border !border-edge !rounded-lg"
            style={{ width: 140, height: 90 }}
            zoomable
            pannable
          />

          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(43,43,43,0.15)" />

          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-edge shadow-sm rounded-lg px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => void ctx.undo()}
                  disabled={!ctx.canUndo}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-teal/30"
                  title="Undo (⌘Z)"
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void ctx.redo()}
                  disabled={!ctx.canRedo}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-teal/30"
                  title="Redo (⌘⇧Z)"
                  aria-label="Redo"
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
                  disabled={ctx.placedItems.length + ctx.boardNotes.length + ctx.shapes.length < 2}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-teal/30"
                  title="Auto-layout (tidy)"
                  aria-label="Auto-layout"
                >
                  <Wand2 size={14} />
                </button>
              </div>
              <ExportMenu containerRef={reactFlowRef} boardName={ctx.project?.title || 'whiteboard'} />
              <FeedbackSyncStatusPill status={ctx.syncStatus} />
              <ShortcutHelpButton />
            </div>
          </Panel>

          {board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <EdgeStyleEditor
                edge={board.selectedEdge}
                onUpdate={board.handleUpdateEdgeStyle}
                onDelete={() => board.handleDeleteEdge(board.selectedEdge!.id)}
                onClose={board.closeEdgeEditor}
              />
            </Panel>
          )}

          {selectionCount >= 2 && !board.selectedEdge && (
            <Panel position="top-right">
              <BulkSelectionToolbar
                count={selectionCount}
                onAlignH={clipboard.handleAlignH}
                onAlignV={clipboard.handleAlignV}
                onDistributeH={clipboard.handleDistributeH}
                onDistributeV={clipboard.handleDistributeV}
                onDelete={clipboard.deleteSelected}
              />
            </Panel>
          )}

          {boardEmpty && !board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <div className="bg-white rounded-2xl border border-edge shadow-lg px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-teal" />
                </div>
                <p className="text-base font-semibold text-ink mb-1">Build your funnel board</p>
                <p className="text-xs text-muted">
                  Click &ldquo;Place on Board&rdquo; in the sidebar to add assets, then drag to arrange and connect them to show the funnel flow.
                </p>
              </div>
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
            onDuplicate={interactions.contextMenu.kind === 'node' ? clipboard.duplicateSelected : undefined}
            onDelete={interactions.contextMenu.kind === 'node' ? clipboard.deleteSelected : undefined}
            onLockToggle={interactions.contextMenu.kind === 'node' ? clipboard.toggleLockSelected : undefined}
            isLocked={interactions.contextMenu.kind === 'node' ? clipboard.lockedNodes.has(interactions.contextMenu.nodeId) : false}
            onEdit={interactions.contextMenu.kind === 'node' ? () => {
              if (interactions.contextMenu?.kind !== 'node') return;
              if (interactions.contextMenu.nodeId.startsWith('shape-')) {
                interactions.setSelectedShapeId(interactions.contextMenu.nodeId.slice(6));
                interactions.setSelectedNoteId(null);
                interactions.setSelectedItemId(null);
              } else if (interactions.contextMenu.nodeId.startsWith('note-')) {
                interactions.setSelectedNoteId(interactions.contextMenu.nodeId.slice(5));
                interactions.setSelectedShapeId(null);
                interactions.setSelectedItemId(null);
              } else {
                interactions.setSelectedItemId(interactions.contextMenu.nodeId);
                interactions.setSelectedShapeId(null);
                interactions.setSelectedNoteId(null);
              }
            } : undefined}
          />
        )}

        <AnimatePresence>
          {interactions.selectedShapeId && (() => {
            const shape = ctx.shapes.find((s) => s.id === interactions.selectedShapeId);
            if (!shape) return null;
            return (
              <ShapeSideDrawer
                key={`shape-${interactions.selectedShapeId}`}
                shape={shape}
                onUpdate={(patch) => ctx.updateShape(shape.id, patch)}
                onDelete={() => { ctx.deleteShape(shape.id); interactions.setSelectedShapeId(null); }}
                onClose={() => interactions.setSelectedShapeId(null)}
              />
            );
          })()}

          {interactions.selectedNoteId && (() => {
            const note = ctx.boardNotes.find((n) => n.id === interactions.selectedNoteId);
            if (!note) return null;
            return (
              <NoteSideDrawer
                key={`note-${interactions.selectedNoteId}`}
                note={note}
                onUpdate={(patch) => ctx.updateNote(note.id, patch)}
                onDelete={() => { ctx.deleteNote(note.id); interactions.setSelectedNoteId(null); }}
                onClose={() => interactions.setSelectedNoteId(null)}
              />
            );
          })()}

          {interactions.selectedItemId && (() => {
            const item = ctx.items.find((i) => i.id === interactions.selectedItemId);
            if (!item) return null;
            return (
              <ItemSideDrawer
                key={`item-${interactions.selectedItemId}`}
                item={item}
                onUpdateColor={(color) => ctx.updateItemBoardColor(item.id, color)}
                onClose={() => interactions.setSelectedItemId(null)}
              />
            );
          })()}
        </AnimatePresence>

        {interactions.previewPaths && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full">
            {interactions.previewPaths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
                fill={p.fill ?? 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

export default function FeedbackBoard(props: Props) {
  return (
    <ReactFlowProvider>
      <FeedbackBoardInner {...props} />
    </ReactFlowProvider>
  );
}
