'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  useReactFlow,
  ConnectionMode,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  MarkerType,
  Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, MousePointer } from 'lucide-react';
import FeedbackItemNode from './nodes/FeedbackItemNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import ShapeNode from './nodes/ShapeNode';
import LabeledEdge from './edges/LabeledEdge';
import EdgeStyleEditor from './EdgeStyleEditor';
import { type BoardTool } from './BoardTopToolbar';
import FeedbackPalette, {
  FEEDBACK_PALETTE_DRAG_MIME,
  type PaletteDragPayload,
} from './FeedbackPalette';
import CanvasContextMenu, { type ContextTarget } from './CanvasContextMenu';
import AlignmentGuides from './AlignmentGuides';
import ShapeSideDrawer from './ShapeSideDrawer';
import NoteSideDrawer from './NoteSideDrawer';
import ExportMenu from './ExportMenu';
import { useFeedbackBoard } from './useFeedbackBoard';
import { useFeedbackBoardContextOrThrow, type NewShape } from './FeedbackBoardContext';
import type { FeedbackShapeType } from '@/lib/types/feedback';
import { roughRect, roughLine, roughPath } from '@/components/feedback/sketchy/roughPath';

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

const defaultEdgeOptions = {
  type: 'labeled',
  animated: false,
  style: { stroke: '#2B2B2B', strokeWidth: 1.8 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2B2B2B', width: 16, height: 16 },
};

const DRAW_COLOR = '#2B2B2B';
const DRAW_STROKE_WIDTH = 2;
const MIN_SHAPE_SIZE = 10;
const ARROW_HEAD = 14;
const ARROW_ANGLE = Math.PI / 6;
const ALIGNMENT_TOLERANCE = 6;

/** Visual centre of a node — used for alignment guides. Falls back to the
 *  RF v12 measured size if available; otherwise the declared width/height. */
function visualCentre(n: Node): { cx: number; cy: number } {
  const m = (n as unknown as { measured?: { width?: number; height?: number } }).measured;
  const w = m?.width ?? (n as { width?: number }).width ?? 100;
  const h = m?.height ?? (n as { height?: number }).height ?? 100;
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2 };
}

function FeedbackBoardInner({ onNavigateToItem }: Props) {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const ctx = useFeedbackBoardContextOrThrow();
  const rf = useReactFlow();
  const [activeTool, setActiveTool] = useState<BoardTool>('select');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ horizontals: number[]; verticals: number[] }>(
    { horizontals: [], verticals: [] }
  );

  const board = useFeedbackBoard({ onNavigateToItem });

  const isDrawingTool =
    activeTool === 'rectangle' || activeTool === 'ellipse' ||
    activeTool === 'arrow' || activeTool === 'line';
  const isTextTool = activeTool === 'text';
  const isSelectTool = activeTool === 'select';

  /** Spawn an action-shape at a given flow position. Used by click-to-add
   *  from the palette (centre of viewport) and by palette drag-and-drop
   *  (drop point). */
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

  const viewportCentre = useCallback(() => {
    const container = reactFlowRef.current;
    const rect = container?.getBoundingClientRect();
    return rect
      ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
      : { x: 200, y: 200 };
  }, [rf]);

  const handlePickShape = useCallback((shapeType: FeedbackShapeType) => {
    const c = viewportCentre();
    addShapeAt(shapeType, c.x, c.y);
  }, [addShapeAt, viewportCentre]);

  const handlePickTool = useCallback((tool: BoardTool) => {
    setActiveTool(tool);
  }, []);

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
      // Sticky: addNote uses an auto-position; we override after insert so
      // the note lands at the drop point.
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
  }, [drawStart, drawCurrent, activeTool, ctx]);

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
    [isTextTool, screenToFlow, ctx]
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

  /* ── Duplicate selected (notes + shapes only; review items are content
       records and aren't safe to clone). ─────────────────────────────── */

  const duplicateSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (selected.length === 0) return;
    for (const node of selected) {
      if (node.id.startsWith('shape-')) {
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
        const next = await ctx.addNote();
        if (next) {
          await ctx.updateNote(next.id, {
            content: orig.content, color: orig.color,
            width: orig.width, height: orig.height, font_size: orig.font_size,
            board_x: orig.board_x + 40, board_y: orig.board_y + 40,
          });
        }
      }
      // Review-item nodes intentionally skipped — duplication semantics
      // unclear (clone content? clone comments? clone attachments?).
    }
  }, [rf, ctx]);

  const deleteSelected = useCallback(async () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    for (const node of selected) {
      if (node.id.startsWith('note-'))       await ctx.deleteNote(node.id.slice(5));
      else if (node.id.startsWith('shape-')) await ctx.deleteShape(node.id.slice(6));
      else                                    await ctx.removeItemFromBoard(node.id);
    }
  }, [rf, ctx]);

  /* ── Smart alignment guides while dragging ─────────────── */

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

  /* ── Click → open the matching side drawer (shapes + notes only;
       review-item nodes keep their existing navigate-to-detail behaviour
       which is handled inside the node component itself). ───────────── */

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('shape-')) {
      setSelectedShapeId(node.id.slice(6));
      setSelectedNoteId(null);
    } else if (node.id.startsWith('note-')) {
      setSelectedNoteId(node.id.slice(5));
      setSelectedShapeId(null);
    } else {
      setSelectedShapeId(null);
      setSelectedNoteId(null);
    }
  }, []);

  const clearDrawerSelection = useCallback(() => {
    setSelectedShapeId(null);
    setSelectedNoteId(null);
  }, []);

  /* ── Keyboard: Cmd+D duplicate ─────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        void duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duplicateSelected]);

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const cursorClass = isDrawingTool || isTextTool ? 'cursor-crosshair' : '';
  const boardEmpty =
    ctx.placedItems.length === 0 &&
    ctx.boardNotes.length === 0 &&
    ctx.shapes.length === 0;

  const selectionCount = rf.getNodes().filter((n) => n.selected).length;

  return (
    <div className="flex h-full min-h-[400px] bg-white rounded-xl border border-edge overflow-hidden shadow-sm">
      <FeedbackPalette
        activeTool={activeTool}
        onPickShape={handlePickShape}
        onPickTool={handlePickTool}
        onPickSticky={handlePickSticky}
      />
      <div
        className={`flex-1 relative bg-notebook ${cursorClass}`}
        ref={reactFlowRef}
        onMouseDown={onContainerMouseDown}
        onMouseMove={onContainerMouseMove}
        onMouseUp={onContainerMouseUp}
        onDragOver={onPaletteDragOver}
        onDrop={onPaletteDrop}
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
          onNodeClick={onNodeClick}
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
          // Selection model (Figma/Funnelytics-style) only when the Select
          // tool is active. Drawing/text modes get their own pane handling.
          panOnDrag={isSelectTool ? [0, 1] : false}
          selectionMode={SelectionMode.Partial}
          panActivationKeyCode="Space"
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionKeyCode={isSelectTool ? 'Shift' : null}
          nodesDraggable={!isDrawingTool}
          nodesConnectable={!isDrawingTool}
          elementsSelectable={!isDrawingTool}
          onPaneClick={(e) => {
            if (isTextTool) onPaneClickForText(e);
            else if (board.selectedEdge) board.closeEdgeEditor();
            clearDrawerSelection();
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
            <ExportMenu containerRef={reactFlowRef} boardName={ctx.project?.title || 'whiteboard'} />
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

          {boardEmpty && !board.selectedEdge && (
            <Panel position="top-center" className="!top-24">
              <div className="bg-white rounded-xl border border-edge shadow-lg px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-teal" />
                </div>
                <p className="text-base font-semibold text-ink mb-1">Build your funnel board</p>
                <p className="text-xs text-muted">
                  Click &ldquo;Place on Board&rdquo; in the sidebar to add items, then drag to arrange and connect them to show the funnel flow.
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
            onDuplicate={contextMenu.kind === 'node' ? duplicateSelected : undefined}
            onDelete={contextMenu.kind === 'node' ? deleteSelected : undefined}
            onEdit={contextMenu.kind === 'node' ? () => {
              if (contextMenu.kind !== 'node') return;
              if (contextMenu.nodeId.startsWith('shape-')) {
                setSelectedShapeId(contextMenu.nodeId.slice(6));
                setSelectedNoteId(null);
              } else if (contextMenu.nodeId.startsWith('note-')) {
                setSelectedNoteId(contextMenu.nodeId.slice(5));
                setSelectedShapeId(null);
              }
            } : undefined}
          />
        )}

        {selectedShapeId && (() => {
          const shape = ctx.shapes.find((s) => s.id === selectedShapeId);
          if (!shape) return null;
          return (
            <ShapeSideDrawer
              shape={shape}
              onUpdate={(patch) => ctx.updateShape(shape.id, patch)}
              onDelete={() => { ctx.deleteShape(shape.id); setSelectedShapeId(null); }}
              onClose={() => setSelectedShapeId(null)}
            />
          );
        })()}

        {selectedNoteId && (() => {
          const note = ctx.boardNotes.find((n) => n.id === selectedNoteId);
          if (!note) return null;
          return (
            <NoteSideDrawer
              note={note}
              onUpdate={(patch) => ctx.updateNote(note.id, patch)}
              onDelete={() => { ctx.deleteNote(note.id); setSelectedNoteId(null); }}
              onClose={() => setSelectedNoteId(null)}
            />
          );
        })()}

        {previewPaths && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full">
            {previewPaths.map((p, i) => (
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
