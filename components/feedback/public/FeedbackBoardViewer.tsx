'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type FeedbackItem, type FeedbackBoardEdge, type FeedbackBoardNote, type FeedbackBoardShape, type FeedbackComment } from '@/lib/supabase';
import { type CompanyBranding } from '@/hooks/useProposal';
import FeedbackItemNode, { type ReviewItemNodeData } from '@/components/admin/feedback/board/nodes/FeedbackItemNode';
import StickyNoteNode, { type StickyNoteNodeData } from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode, { type ShapeNodeData } from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import { type EdgeTypes } from '@xyflow/react';

/* ─── Types ────────────────────────────────────────────────────── */

interface ReviewBoardViewerProps {
  items: FeedbackItem[];
  boardEdges: FeedbackBoardEdge[];
  boardNotes: FeedbackBoardNote[];
  boardShapes?: FeedbackBoardShape[];
  comments: FeedbackComment[];
  branding: CompanyBranding;
  onSelectItem: (itemId: string) => void;
}

/* ─── Node type registry ───────────────────────────────────────── */

const nodeTypes: NodeTypes = {
  reviewItem: FeedbackItemNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};
/* ─── Component ────────────────────────────────────────────────── */

export default function FeedbackBoardViewer({
  items,
  boardEdges,
  boardNotes,
  boardShapes = [],
  comments,
  branding,
  onSelectItem,
}: ReviewBoardViewerProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const accent = branding.accent_color || '#01434A';

  // Only items that are placed on the board
  const placedItems = useMemo(
    () => items.filter((i) => i.board_x != null && i.board_y != null),
    [items]
  );

  // Build comment counts per item
  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of comments) {
      if (!c.parent_comment_id && !c.resolved) {
        counts[c.review_item_id] = (counts[c.review_item_id] || 0) + 1;
      }
    }
    return counts;
  }, [comments]);

  // Build nodes
  useEffect(() => {
    const itemNodes: Node[] = placedItems.map((item) => ({
      id: item.id,
      type: 'reviewItem',
      position: { x: item.board_x!, y: item.board_y! },
      draggable: false,
      selectable: true,
      data: {
        item,
        readOnly: true,
        onNavigate: onSelectItem,
      } satisfies ReviewItemNodeData,
    }));

    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      draggable: false,
      selectable: false,
      data: {
        note,
        readOnly: true,
      } satisfies StickyNoteNodeData,
    }));

    const shapeNodes: Node[] = boardShapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      draggable: false,
      selectable: shape.shape_type === 'decision',
      data: {
        shape,
        readOnly: true,
      } satisfies ShapeNodeData,
    }));

    setNodes([...itemNodes, ...noteNodes, ...shapeNodes]);
  }, [placedItems, boardNotes, boardShapes, commentCounts, onSelectItem]);

  // Build edges — mirror the admin board's edge shape so LabeledEdge sees
  // arrowDir/label/dashed via `data`. The old top-level `label`/`markerEnd`
  // fields were ignored by our custom edge renderer, which is why
  // user-set arrows weren't showing on the public view.
  useEffect(() => {
    const flowEdges: Edge[] = boardEdges
      .map((e) => {
        const strokeColor = (e.style as Record<string, string>)?.stroke || accent;
        const strokeWidth = Number((e.style as Record<string, number>)?.strokeWidth) || 2;
        const dashed = !!(e.style as Record<string, boolean>)?.dashed;
        const rawArrow = (e.style as Record<string, string> | null | undefined)?.arrowDir;
        const arrowDir: 'none' | 'source' | 'target' | 'both' =
          rawArrow === 'none' || rawArrow === 'source' || rawArrow === 'both' ? rawArrow : 'target';
        const source = e.source_shape_id ? `shape-${e.source_shape_id}` : e.source_item_id;
        const target = e.target_shape_id ? `shape-${e.target_shape_id}` : e.target_item_id;
        if (!source || !target) return null;
        return {
          id: e.id,
          source,
          target,
          sourceHandle: e.source_handle || 'right',
          targetHandle: e.target_handle || 'left',
          type: 'labeled',
          animated: e.animated || false,
          style: { stroke: strokeColor, strokeWidth },
          data: {
            label: e.label || undefined,
            color: strokeColor,
            strokeWidth,
            dashed,
            animated: e.animated || false,
            arrowDir,
          },
        } as Edge;
      })
      .filter((e): e is Edge => e !== null);

    setEdges(flowEdges);
  }, [boardEdges, accent]);

  // Handle node click — navigate to item viewer
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only navigate for feedback item nodes — skip notes and shapes.
      if (node.id.startsWith('note-') || node.id.startsWith('shape-')) return;
      onSelectItem(node.id);
    },
    [onSelectItem]
  );

  if (placedItems.length === 0 && boardNotes.length === 0 && boardShapes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8 bg-notebook">
        <div>
          <p className="font-hand text-lg text-sketch-ink/60">No items on the board yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-feedback-board w-full h-full bg-notebook">
      {/* Hide all handle dots on the read-only client view — the handle DOM
          nodes stay in place so React Flow can still anchor edges to them,
          they just have no visible dot/border. */}
      <style>{`
        .public-feedback-board .react-flow__handle {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          pointer-events: none !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
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
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}