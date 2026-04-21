'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  useReactFlow,
  ConnectionMode,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, MousePointer } from 'lucide-react';
import FeedbackItemNode from './nodes/FeedbackItemNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import ShapeNode from './nodes/ShapeNode';
import LabeledEdge from './edges/LabeledEdge';
import EdgeStyleEditor from './EdgeStyleEditor';
import BoardTopToolbar, { type BoardTool } from './BoardTopToolbar';
import { useFeedbackBoard } from './useFeedbackBoard';
import { useFeedbackBoardContextOrThrow, type NewShape } from './FeedbackBoardContext';
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

function FeedbackBoardInner({ onNavigateToItem }: Props) {
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const ctx = useFeedbackBoardContextOrThrow();
  const rf = useReactFlow();
  const [activeTool, setActiveTool] = useState<BoardTool>('select');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const board = useFeedbackBoard({ onNavigateToItem });

  const isDrawingTool =
    activeTool === 'rectangle' || activeTool === 'ellipse' ||
    activeTool === 'arrow' || activeTool === 'line';
  const isTextTool = activeTool === 'text';

  const handleToolSelect = useCallback((tool: BoardTool) => {
    if (tool === 'sticky') {
      void ctx.addNote();
      setActiveTool('select');
      return;
    }
    if (tool === 'decision' || tool === 'wait') {
      // Drop the shape near the centre of the current viewport so it's
      // immediately visible, not hidden off-screen.
      const container = reactFlowRef.current;
      const rect = container?.getBoundingClientRect();
      const centre = rect
        ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
        : { x: 200, y: 200 };
      // Rough half-size to centre the spawn; the visual sizes are owned by
      // the node components, we just ballpark it so the drop point feels right.
      const offsetX = tool === 'decision' ? 86 : 70;
      const offsetY = tool === 'decision' ? 86 : 60;
      void ctx.createShape({
        shape_type: tool,
        x: Math.round(centre.x - offsetX),
        y: Math.round(centre.y - offsetY),
        width: null, height: null, end_x: null, end_y: null,
        content: null,
        color: DRAW_COLOR, stroke_width: DRAW_STROKE_WIDTH, dashed: false,
        font_size: null,
      });
      setActiveTool('select');
      return;
    }
    setActiveTool(tool);
  }, [ctx, rf]);

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

  return (
    <div className="flex h-full min-h-[400px] bg-paper rounded-xl border-2 border-sketch-ink/70 overflow-hidden shadow-sketch">
      <div
        className={`flex-1 relative bg-notebook ${cursorClass}`}
        ref={reactFlowRef}
        onMouseDown={onContainerMouseDown}
        onMouseMove={onContainerMouseMove}
        onMouseUp={onContainerMouseUp}
      >
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
          snapToGrid
          snapGrid={[20, 20]}
          style={{ background: 'transparent' }}
          deleteKeyCode={['Backspace', 'Delete']}
          panOnDrag={!isDrawingTool && !isTextTool}
          nodesDraggable={!isDrawingTool}
          nodesConnectable={!isDrawingTool}
          elementsSelectable={!isDrawingTool}
          onPaneClick={isTextTool ? onPaneClickForText : undefined}
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
            className="!bg-paper !border-2 !border-sketch-ink/60 !shadow-sketch !rounded-lg"
          />
          <MiniMap
            nodeClassName={(node) => {
              if (node.type === 'stickyNote') return 'fill-sticky-yellow';
              if (node.type === 'shape') return 'fill-sketch-ink/40';
              return 'fill-paper stroke-sketch-ink/40';
            }}
            className="!bg-paper-dark !border-2 !border-sketch-ink/50 !rounded-lg"
            style={{ width: 140, height: 90 }}
            zoomable
            pannable
          />

          <Panel position="top-right">
            <BoardTopToolbar activeTool={activeTool} onToolSelect={handleToolSelect} />
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
              <div className="bg-paper rounded-xl border-2 border-sketch-ink/70 shadow-sketch px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-teal" />
                </div>
                <p className="font-hand text-lg text-sketch-ink mb-1">Build your funnel board</p>
                <p className="text-xs text-sketch-ink/60">
                  Click &ldquo;Place on Board&rdquo; in the sidebar to add items, then drag to arrange and connect them to show the funnel flow.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

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
