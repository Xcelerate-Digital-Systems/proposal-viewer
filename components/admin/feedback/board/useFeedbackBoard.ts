'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
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

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, delay]) as T;
}

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
    createEdge, updateEdge,
  } = ctx;

  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  /* ─── Build RF nodes from context data ─────────────────────── */

  const handleShapeContentUpdate = useCallback(
    (id: string, content: string) => { void updateShape(id, { content }); },
    [updateShape]
  );

  useEffect(() => {
    const itemNodes: Node[] = placedItems.map((item) => ({
      id: item.id,
      type: 'reviewItem',
      position: { x: item.board_x!, y: item.board_y! },
      data: {
        item,
        readOnly: false,
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
  }, [placedItems, boardNotes, shapes, onNavigateToItem, updateItemStatus, updateNote, deleteNote, handleShapeContentUpdate, setNodes]);

  /* ─── Build RF edges from context data ─────────────────────── */

  const handleEdgeClickFromData = useCallback((edgeId: string) => {
    setEdges((eds) => {
      const edge = eds.find((e) => e.id === edgeId);
      if (edge) setSelectedEdge(edge);
      return eds;
    });
  }, [setEdges]);

  useEffect(() => {
    const flowEdges: Edge[] = boardEdges
      .map((e) => {
        const strokeColor = (e.style as Record<string, string>)?.stroke || '#2B2B2B';
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
            onEdgeClick: handleEdgeClickFromData,
          },
        } as Edge;
      })
      .filter((e): e is Edge => e !== null);
    setEdges(flowEdges);
  }, [boardEdges, handleEdgeClickFromData, setEdges]);

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

  const debouncedSavePosition = useDebouncedCallback(saveNodePosition, 300);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          debouncedSavePosition(change.id, change.position.x, change.position.y);
        }
      }
    },
    [debouncedSavePosition, setNodes]
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

      if (!isNoteEdge) {
        // RF node ids: items use the raw item id, shapes use `shape-{uuid}`. Split
        // into item vs shape columns so FK cascades behave correctly.
        const sourceIsShape = connection.source.startsWith('shape-');
        const targetIsShape = connection.target.startsWith('shape-');
        const sourceId = sourceIsShape ? connection.source.slice(6) : connection.source;
        const targetId = targetIsShape ? connection.target.slice(6) : connection.target;
        await createEdge({
          review_project_id: ctx.projectId,
          company_id: ctx.companyId,
          source_item_id: sourceIsShape ? null : sourceId,
          source_shape_id: sourceIsShape ? sourceId : null,
          target_item_id: targetIsShape ? null : targetId,
          target_shape_id: targetIsShape ? targetId : null,
          source_handle: connection.sourceHandle || 'right',
          target_handle: connection.targetHandle || 'left',
          edge_type: 'labeled',
          animated: false,
          label: null,
          style: { stroke: '#2B2B2B', strokeWidth: 2 },
        });
      } else {
        // Sticky-note edges are purely visual; render in RF state only
        const newEdge: Edge = {
          id: `temp-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          type: 'labeled',
          style: { stroke: '#2B2B2B', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2B2B2B', width: 16, height: 16 },
          data: { color: '#2B2B2B', strokeWidth: 2, onEdgeClick: handleEdgeClickFromData },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [ctx.projectId, ctx.companyId, createEdge, handleEdgeClickFromData, setEdges]
  );

  /* ─── Edge delete & style updates ─────────────────────────── */

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!edgeId.startsWith('temp-')) {
        await ctx.deleteEdge(edgeId);
      }
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [ctx, setEdges]
  );

  const handleUpdateEdgeStyle = useCallback(
    async (
      edgeId: string,
      patch: { label?: string | null; color?: string; strokeWidth?: number; dashed?: boolean; animated?: boolean; arrowDir?: 'none' | 'source' | 'target' | 'both' }
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
        } as Record<string, unknown>,
      });
    },
    [updateEdge, setEdges]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeClick,
    selectedEdge,
    handleUpdateEdgeStyle,
    handleDeleteEdge,
    closeEdgeEditor: () => setSelectedEdge(null),
  };
}
