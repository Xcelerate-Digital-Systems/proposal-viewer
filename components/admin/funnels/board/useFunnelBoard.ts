'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState, useEdgesState, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import type { FeedbackBoardShape, FeedbackBoardNote } from '@/lib/supabase';
import { type FunnelStepNodeData } from './nodes/FunnelStepNode';
import { type StickyNoteNodeData } from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import { type ShapeNodeData } from '@/components/admin/feedback/board/nodes/ShapeNode';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, delay]) as T;
}

/**
 * RF plumbing for the funnel board — mirrors useFeedbackBoard but renders
 * FunnelStep + reused Sticky/Shape nodes. ShapeNode's data type expects a
 * FeedbackBoardShape; we cast our funnel shapes since the component only
 * reads visual fields (shape_type, x/y/w/h, content, color, …) — never the
 * FK column.
 */
export function useFunnelBoard() {
  const ctx = useFunnelBoardContextOrThrow();
  const {
    steps, boardNotes, shapes, boardEdges,
    updateStep, deleteStep, deleteNote,
    updateNote, updateShape,
    createEdge, updateEdge, deleteEdge,
  } = ctx;

  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  /* ── Build nodes ───────────────────────────────────────────── */

  const handleShapeContentUpdate = useCallback(
    (id: string, content: string) => { void updateShape(id, { content }); },
    [updateShape]
  );

  useEffect(() => {
    const stepNodes: Node[] = steps.map((step) => ({
      id: `step-${step.id}`,
      type: 'funnelStep',
      position: { x: step.board_x, y: step.board_y },
      data: {
        step,
        readOnly: false,
        onUpdate: updateStep,
        onDelete: deleteStep,
      } satisfies FunnelStepNodeData,
    }));

    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      data: {
        // StickyNoteNode reads only display fields — cast across the FK rename.
        note: note as unknown as FeedbackBoardNote,
        readOnly: false,
        onUpdate: (id, changes) => void updateNote(id, changes as Partial<typeof note>),
        onDelete: (id) => void deleteNote(id),
      } satisfies StickyNoteNodeData,
    }));

    const shapeNodes: Node[] = shapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      data: {
        shape: shape as unknown as FeedbackBoardShape,
        readOnly: false,
        onUpdateContent: handleShapeContentUpdate,
      } satisfies ShapeNodeData,
    }));

    setNodes([...stepNodes, ...noteNodes, ...shapeNodes]);
  }, [steps, boardNotes, shapes, updateStep, deleteStep, updateNote, deleteNote, handleShapeContentUpdate, setNodes]);

  /* ── Build edges ───────────────────────────────────────────── */

  const handleEdgeClickFromData = useCallback((edgeId: string) => {
    setEdges((eds) => {
      const edge = eds.find((e) => e.id === edgeId);
      if (edge) setSelectedEdge(edge);
      return eds;
    });
  }, [setEdges]);

  useEffect(() => {
    const flow: Edge[] = boardEdges.map((e) => {
      const style = (e.style || {}) as Record<string, unknown>;
      const strokeColor = (style.stroke as string) || '#2B2B2B';
      const strokeWidth = Number(style.strokeWidth) || 2;
      const dashed = !!style.dashed;
      const rawArrow = style.arrowDir as string | undefined;
      const arrowDir: 'none' | 'source' | 'target' | 'both' =
        rawArrow === 'none' || rawArrow === 'source' || rawArrow === 'both' ? rawArrow : 'target';
      const labelFontSize = Number(style.labelFontSize) || 16;
      const labelColor = (style.labelColor as string) || '#2B2B2B';

      const source = e.source_shape_id ? `shape-${e.source_shape_id}` : `step-${e.source_step_id}`;
      const target = e.target_shape_id ? `shape-${e.target_shape_id}` : `step-${e.target_step_id}`;

      const isSelected = selectedEdge?.id === e.id;
      const userLabel = e.label || '';
      const displayLabel = userLabel || undefined;

      return {
        id: e.id,
        source, target,
        sourceHandle: e.source_handle || 'right',
        targetHandle: e.target_handle || 'left',
        type: 'labeled',
        animated: e.animated || false,
        style: { stroke: strokeColor, strokeWidth },
        data: {
          label: displayLabel,
          // Stashed raw user label so handleUpdateEdgeStyle can preserve it
          // when only styling fields change (and not overwrite with composite).
          userLabel: userLabel || null,
          color: strokeColor, strokeWidth, dashed,
          animated: e.animated || false, arrowDir,
          labelFontSize, labelColor,
          onEdgeClick: handleEdgeClickFromData,
        },
      } as Edge;
    });
    setEdges(flow);
  }, [boardEdges, handleEdgeClickFromData, setEdges, selectedEdge?.id]);

  /* ── Drag save ─────────────────────────────────────────────── */

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) {
      await updateNote(nodeId.replace('note-', ''), { board_x: x, board_y: y });
    } else if (nodeId.startsWith('shape-')) {
      await updateShape(nodeId.replace('shape-', ''), { x, y });
    } else if (nodeId.startsWith('step-')) {
      await updateStep(nodeId.replace('step-', ''), { board_x: x, board_y: y });
    }
  }, [updateNote, updateShape, updateStep]);

  const debouncedSavePosition = useDebouncedCallback(saveNodePosition, 250);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) {
        debouncedSavePosition(c.id, c.position.x, c.position.y);
      }
    }
  }, [debouncedSavePosition, setNodes]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  /* ── Connect / delete / style ──────────────────────────────── */

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // RF node ids: steps use `step-{uuid}`, shapes `shape-{uuid}`. Sticky-note
    // edges are visual-only and not persisted.
    if (connection.source.startsWith('note-') || connection.target.startsWith('note-')) return;

    const srcIsShape = connection.source.startsWith('shape-');
    const tgtIsShape = connection.target.startsWith('shape-');
    const srcId = connection.source.replace(/^(step|shape)-/, '');
    const tgtId = connection.target.replace(/^(step|shape)-/, '');

    await createEdge({
      funnel_id: ctx.funnelId,
      company_id: ctx.companyId,
      source_step_id: srcIsShape ? null : srcId,
      source_shape_id: srcIsShape ? srcId : null,
      target_step_id: tgtIsShape ? null : tgtId,
      target_shape_id: tgtIsShape ? tgtId : null,
      source_handle: connection.sourceHandle || 'right',
      target_handle: connection.targetHandle || 'left',
      edge_type: 'labeled',
      animated: false,
      label: null,
      split_percent: null,
      style: { stroke: '#2B2B2B', strokeWidth: 2 },
    });
  }, [ctx.funnelId, ctx.companyId, createEdge]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await deleteEdge(edgeId);
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  }, [deleteEdge, setEdges]);

  const handleUpdateEdgeStyle = useCallback(
    async (edgeId: string, patch: {
      label?: string | null; color?: string; strokeWidth?: number;
      dashed?: boolean; animated?: boolean;
      arrowDir?: 'none' | 'source' | 'target' | 'both';
      labelFontSize?: number; labelColor?: string;
    }) => {
      let nextEdge: Edge | undefined;
      setEdges((eds) => {
        const edge = eds.find((e) => e.id === edgeId);
        if (!edge) return eds;
        const currentData = (edge.data || {}) as Record<string, unknown>;
        const currentStyle = (edge.style || {}) as Record<string, unknown>;
        const nextLabel = patch.label !== undefined
          ? (patch.label?.trim() || null)
          : ((currentData.userLabel as string | null) ?? null);
        const nextColor = patch.color ?? (currentData.color as string) ?? (currentStyle.stroke as string) ?? '#2B2B2B';
        const nextStrokeWidth = patch.strokeWidth ?? (currentStyle.strokeWidth as number) ?? 2;
        const nextDashed = patch.dashed !== undefined ? patch.dashed : !!(currentData.dashed as boolean);
        const nextAnimated = patch.animated !== undefined ? patch.animated : !!edge.animated;
        const nextArrowDir = patch.arrowDir ?? ((currentData.arrowDir as 'none' | 'source' | 'target' | 'both') ?? 'target');
        const nextLabelFontSize = patch.labelFontSize ?? (currentData.labelFontSize as number) ?? 16;
        const nextLabelColor = patch.labelColor ?? (currentData.labelColor as string) ?? '#2B2B2B';
        const updated: Edge = {
          ...edge,
          animated: nextAnimated,
          style: { stroke: nextColor, strokeWidth: nextStrokeWidth },
          markerEnd: undefined, markerStart: undefined,
          data: {
            ...currentData,
            label: nextLabel || undefined,
            color: nextColor, strokeWidth: nextStrokeWidth, dashed: nextDashed,
            animated: nextAnimated, arrowDir: nextArrowDir,
            labelFontSize: nextLabelFontSize, labelColor: nextLabelColor,
          },
        };
        nextEdge = updated;
        return eds.map((e) => (e.id === edgeId ? updated : e));
      });
      setSelectedEdge((prev) => (prev && prev.id === edgeId && nextEdge ? nextEdge : prev));
      if (!nextEdge) return;
      await updateEdge(edgeId, {
        label: ((nextEdge.data as Record<string, unknown>)?.label as string | null) ?? null,
        animated: nextEdge.animated ?? false,
        style: {
          stroke: nextEdge.style?.stroke,
          strokeWidth: nextEdge.style?.strokeWidth,
          dashed: (nextEdge.data as Record<string, unknown>)?.dashed,
          arrowDir: (nextEdge.data as Record<string, unknown>)?.arrowDir,
          labelFontSize: (nextEdge.data as Record<string, unknown>)?.labelFontSize,
          labelColor: (nextEdge.data as Record<string, unknown>)?.labelColor,
        } as Record<string, unknown>,
      });
    },
    [updateEdge, setEdges]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => setSelectedEdge(edge), []);

  return {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect, onEdgeClick,
    selectedEdge, handleUpdateEdgeStyle, handleDeleteEdge,
    closeEdgeEditor: () => setSelectedEdge(null),
  };
}
