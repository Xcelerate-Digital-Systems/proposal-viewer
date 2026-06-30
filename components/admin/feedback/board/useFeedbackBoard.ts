'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from '@xyflow/react';
import { type ReviewItemNodeData } from './nodes/FeedbackItemNode';
import { type StickyNoteNodeData } from './nodes/StickyNoteNode';
import { type ShapeNodeData } from './nodes/ShapeNode';
import { useFeedbackBoardContextOrThrow } from './FeedbackBoardContext';

interface UseFeedbackBoardOptions {
  onNavigateToItem: (itemId: string) => void;
}

/**
 * React Flow plumbing: turns the feedback-board context data into RF nodes/edges,
 * wires up drag-save, edge creation, and edge selection. All persistence lives in
 * FeedbackBoardContext — this hook only manages RF state.
 */
export function useFeedbackBoard({ onNavigateToItem }: UseFeedbackBoardOptions) {
  const ctx = useFeedbackBoardContextOrThrow();
  const {
    placedItems, boardNotes, shapes, boardEdges,
    updateItemStatus, updateItemBoardPosition,
    updateNote, deleteNote, updateShape,
    createEdge, updateEdge, commentStats,
  } = ctx;

  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  /* ─── Build RF nodes from context data ─────────────────────── */

  const handleShapeContentUpdate = useCallback(
    (id: string, content: string) => {
      try {
        const parsed = JSON.parse(content);
        if (parsed?.__resize) {
          const patch: Record<string, number> = {};
          if (parsed.end_x !== undefined) patch.end_x = parsed.end_x;
          if (parsed.end_y !== undefined) patch.end_y = parsed.end_y;
          void updateShape(id, patch);
          if (parsed.move_x || parsed.move_y) {
            const shape = ctx.shapes.find((s) => s.id === id);
            if (shape) void updateShape(id, { ...patch, x: shape.x + parsed.move_x, y: shape.y + parsed.move_y });
          }
          return;
        }
      } catch { /* not JSON — normal content update */ }
      void updateShape(id, { content });
    },
    [updateShape, ctx.shapes]
  );

  useEffect(() => {
    const itemNodes: Node[] = placedItems.map((item) => ({
      id: item.id,
      type: 'reviewItem',
      position: { x: item.board_x!, y: item.board_y! },
      data: {
        item,
        readOnly: false,
        commentStats: commentStats.get(item.id),
        onNavigate: onNavigateToItem,
        onUpdateStatus: updateItemStatus,
      } satisfies ReviewItemNodeData,
    }));

    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      data: {
        note,
        readOnly: false,
        onUpdate: updateNote,
        onDelete: deleteNote,
      } satisfies StickyNoteNodeData,
    }));

    const shapeNodes: Node[] = shapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      data: {
        shape,
        readOnly: false,
        onUpdateContent: handleShapeContentUpdate,
      } satisfies ShapeNodeData,
    }));

    setNodes([...itemNodes, ...noteNodes, ...shapeNodes]);
  }, [placedItems, boardNotes, shapes, commentStats, onNavigateToItem, updateItemStatus, updateNote, deleteNote, handleShapeContentUpdate, setNodes]);

  /* ─── Build RF edges from context data ─────────────────────── */

  useEffect(() => {
    const noteIds = new Set(boardNotes.map((n) => n.id));
    const resolveEndpoint = (shapeId: string | null, itemId: string | null) => {
      if (shapeId && noteIds.has(shapeId)) return `note-${shapeId}`;
      if (shapeId) return `shape-${shapeId}`;
      return itemId;
    };
    const flowEdges: Edge[] = boardEdges
      .map((e) => {
        const strokeColor = (e.style as Record<string, string>)?.stroke || '#2B2B2B';
        const strokeWidth = Number((e.style as Record<string, number>)?.strokeWidth) || 2;
        const dashed = !!(e.style as Record<string, boolean>)?.dashed;
        const rawArrow = (e.style as Record<string, string> | null | undefined)?.arrowDir;
        const arrowDir: 'none' | 'source' | 'target' | 'both' =
          rawArrow === 'none' || rawArrow === 'source' || rawArrow === 'both' ? rawArrow : 'target';
        const labelFontSize = Number((e.style as Record<string, number> | null | undefined)?.labelFontSize) || 16;
        const labelColor = (e.style as Record<string, string> | null | undefined)?.labelColor || '#2B2B2B';
        const source = resolveEndpoint(e.source_shape_id, e.source_item_id);
        const target = resolveEndpoint(e.target_shape_id, e.target_item_id);
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
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 16,
            height: 16,
          },
          data: {
            label: e.label || undefined,
            color: strokeColor,
            strokeWidth,
            dashed,
            animated: e.animated || false,
            arrowDir,
            labelFontSize,
            labelColor,
          },
        } as Edge;
      })
      .filter((e): e is Edge => e !== null);
    setEdges(flowEdges);
  }, [boardEdges, boardNotes, setEdges]);

  /* ─── Drag position save ──────────────────────────────────── */

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) {
      await updateNote(nodeId.replace('note-', ''), { board_x: x, board_y: y });
    } else if (nodeId.startsWith('shape-')) {
      await updateShape(nodeId.replace('shape-', ''), { x, y });
    } else {
      await updateItemBoardPosition(nodeId, x, y);
    }
  }, [updateNote, updateShape, updateItemBoardPosition]);

  const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPositions = useCallback(() => {
    const batch = new Map(pendingPositions.current);
    pendingPositions.current.clear();
    batch.forEach(({ x, y }, nodeId) => void saveNodePosition(nodeId, x, y));
  }, [saveNodePosition]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      let hasDragEnd = false;
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          pendingPositions.current.set(change.id, change.position);
          hasDragEnd = true;
        }
      }
      if (hasDragEnd) {
        if (positionTimer.current) clearTimeout(positionTimer.current);
        positionTimer.current = setTimeout(flushPositions, 300);
      }
    },
    [flushPositions, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => { setEdges((eds) => applyEdgeChanges(changes, eds)); },
    [setEdges]
  );

  /* ─── Edge creation (RF connect handler → context) ─────────── */

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const isNoteEdge =
        connection.source.startsWith('note-') || connection.target.startsWith('note-');

      // RF node ids: items use the raw item id, shapes use `shape-{uuid}`,
      // notes use `note-{uuid}`. Split into item vs shape columns so FK
      // cascades behave correctly. Note edges are now persisted as shape edges
      // (source_shape_id / target_shape_id) — the edge table doesn't have
      // dedicated note FK columns, but notes are board objects like shapes.
      const resolveId = (rfId: string) => {
        if (rfId.startsWith('shape-')) return { itemId: null, shapeId: rfId.slice(6), noteId: null };
        if (rfId.startsWith('note-'))  return { itemId: null, shapeId: null, noteId: rfId.slice(5) };
        return { itemId: rfId, shapeId: null, noteId: null };
      };
      const src = resolveId(connection.source);
      const tgt = resolveId(connection.target);

      // Note edges: store note IDs in the shape FK columns so they persist.
      await createEdge({
        review_project_id: ctx.projectId,
        company_id: ctx.companyId,
        source_item_id: src.itemId,
        source_shape_id: src.shapeId || src.noteId,
        target_item_id: tgt.itemId,
        target_shape_id: tgt.shapeId || tgt.noteId,
        source_handle: connection.sourceHandle || 'right',
        target_handle: connection.targetHandle || 'left',
        edge_type: 'labeled',
        animated: false,
        label: null,
        style: { stroke: '#2B2B2B', strokeWidth: 2 },
      });
    },
    [ctx.projectId, ctx.companyId, createEdge]
  );

  /* ─── Edge delete & style updates ─────────────────────────── */

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      await ctx.deleteEdge(edgeId);
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [ctx, setEdges]
  );

  const handleUpdateEdgeStyle = useCallback(
    async (
      edgeId: string,
      patch: { label?: string | null; color?: string; strokeWidth?: number; dashed?: boolean; animated?: boolean; arrowDir?: 'none' | 'source' | 'target' | 'both'; labelFontSize?: number; labelColor?: string }
    ) => {
      let nextEdge: Edge | undefined;
      setEdges((eds) => {
        const edge = eds.find((e) => e.id === edgeId);
        if (!edge) return eds;
        const currentData = (edge.data || {}) as Record<string, unknown>;
        const currentStyle = (edge.style || {}) as Record<string, unknown>;
        const nextLabel = patch.label !== undefined
          ? (patch.label?.trim() || null)
          : ((currentData.label as string | null) ?? (edge.label as string | null) ?? null);
        const nextColor = patch.color ?? (currentData.color as string) ?? (currentStyle.stroke as string) ?? '#2B2B2B';
        const nextStrokeWidth = patch.strokeWidth ?? (currentStyle.strokeWidth as number) ?? 2;
        const nextDashed = patch.dashed !== undefined ? patch.dashed : !!(currentData.dashed as boolean);
        const nextAnimated = patch.animated !== undefined ? patch.animated : !!edge.animated;
        const currentArrowDir = (currentData.arrowDir as string) ?? 'target';
        const nextArrowDir = patch.arrowDir ?? (currentArrowDir as 'none' | 'source' | 'target' | 'both');
        const nextLabelFontSize = patch.labelFontSize ?? (currentData.labelFontSize as number) ?? 16;
        const nextLabelColor = patch.labelColor ?? (currentData.labelColor as string) ?? '#2B2B2B';
        const updated: Edge = {
          ...edge,
          animated: nextAnimated,
          style: { stroke: nextColor, strokeWidth: nextStrokeWidth },
          // Arrow rendering is handled inside LabeledEdge — strip the default
          // React Flow marker so it doesn't double up with our custom heads.
          markerEnd: undefined,
          markerStart: undefined,
          data: {
            ...currentData,
            label: nextLabel || undefined,
            color: nextColor,
            strokeWidth: nextStrokeWidth,
            dashed: nextDashed,
            animated: nextAnimated,
            arrowDir: nextArrowDir,
            labelFontSize: nextLabelFontSize,
            labelColor: nextLabelColor,
          },
        };
        nextEdge = updated;
        return eds.map((e) => (e.id === edgeId ? updated : e));
      });

      setSelectedEdge((prev) => (prev && prev.id === edgeId && nextEdge ? nextEdge : prev));

      if (!nextEdge || edgeId.startsWith('temp-')) return;

      await updateEdge(edgeId, {
        label: ((nextEdge.data as Record<string, unknown>)?.label as string | null) ?? null,
        animated: nextEdge.animated ?? false,
        style: {
          stroke: nextEdge.style?.stroke,
          strokeWidth: nextEdge.style?.strokeWidth,
          dashed: (nextEdge.data as Record<string, unknown>)?.dashed as boolean,
          arrowDir: (nextEdge.data as Record<string, unknown>)?.arrowDir,
          labelFontSize: (nextEdge.data as Record<string, unknown>)?.labelFontSize,
          labelColor: (nextEdge.data as Record<string, unknown>)?.labelColor,
        } as Record<string, unknown>,
      });
    },
    [updateEdge, setEdges]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  const onReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return;
      await ctx.deleteEdge(oldEdge.id);
      await onConnect(newConnection);
    },
    [ctx, onConnect]
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    onEdgeClick,
    selectedEdge,
    handleUpdateEdgeStyle,
    handleDeleteEdge,
    closeEdgeEditor: () => setSelectedEdge(null),
  };
}
