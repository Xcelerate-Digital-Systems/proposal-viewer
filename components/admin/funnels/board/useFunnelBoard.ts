'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState, useEdgesState, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import type { FeedbackBoardShape, FeedbackBoardNote } from '@/lib/supabase';
import { formatCount } from '@/lib/funnel/forecast';
import { nodeInSection } from '@/lib/types/funnel';
import { type SectionNodeData } from './nodes/SectionNode';
import { type FunnelStepNodeData } from './nodes/FunnelStepNode';
import { type StickyNoteNodeData } from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import { type ShapeNodeData } from '@/components/admin/feedback/board/nodes/ShapeNode';
import { useFunnelBoardContextOrThrow } from './FunnelBoardContext';
import { computeSnapPosition, ALIGNMENT_TOLERANCE } from '@/components/admin/shared/board-utils';
import { visualCentre } from './funnel-board-config';

/**
 * RF plumbing for the funnel board — mirrors useFeedbackBoard but renders
 * FunnelStep + reused Sticky/Shape nodes. ShapeNode's data type expects a
 * FeedbackBoardShape; we cast our funnel shapes since the component only
 * reads visual fields (shape_type, x/y/w/h, content, color, …) — never the
 * FK column.
 */
export function useFunnelBoard(flowByEdge?: Map<string, number>) {
  const ctx = useFunnelBoardContextOrThrow();
  const {
    steps, boardNotes, shapes, boardEdges, tabs, sections, viewAsRoleId,
    updateStep, deleteStep, deleteNote,
    updateNote, updateShape, updateSection,
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

  const handleSectionRename = useCallback(
    (id: string, label: string) => { void updateSection(id, { label }); },
    [updateSection]
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
        tabs,
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
        description: note.description,
      } satisfies StickyNoteNodeData,
    }));

    // Sections go first in the array and carry a negative zIndex so they paint
    // behind every other node — they're backdrops, not participants.
    const sectionNodes: Node[] = sections.map((section) => ({
      id: `section-${section.id}`,
      type: 'section',
      position: { x: section.x, y: section.y },
      style: { width: section.width, height: section.height },
      zIndex: -1,
      data: {
        section,
        readOnly: false,
        onRename: handleSectionRename,
      } satisfies SectionNodeData,
    }));

    const shapeNodes: Node[] = shapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      data: {
        shape: shape as unknown as FeedbackBoardShape,
        readOnly: false,
        onUpdateContent: handleShapeContentUpdate,
        linkedFunnelId: shape.linked_funnel_id,
        linkedTabId: shape.linked_tab_id,
        tabs,
        description: shape.description,
        message: shape.message,
      } satisfies ShapeNodeData,
    }));

    setNodes(() => {
      // "View as": fade nodes not owned by the selected role. Applied here on
      // the node object rather than inside each node component, so one rule
      // covers steps, shapes, notes and sections alike. Nodes fade rather than
      // hide — the connections between owners are the point of the map.
      const dimFor = (roleId: string | null | undefined) =>
        viewAsRoleId && roleId !== viewAsRoleId ? 0.25 : 1;

      const newNodes = [...sectionNodes, ...stepNodes, ...noteNodes, ...shapeNodes].map((n) => {
        if (!viewAsRoleId) return n;
        // Sections and notes carry no owner, so they stay at full strength.
        if (n.type === 'section' || n.type === 'stickyNote') return n;
        const source = n.type === 'funnelStep'
          ? (n.data as { step?: { role_id?: string | null } }).step?.role_id
          : (n.data as { shape?: { role_id?: string | null } }).shape?.role_id;
        return { ...n, style: { ...(n.style || {}), opacity: dimFor(source), transition: 'opacity 150ms' } };
      });
      return newNodes;
    });
  }, [steps, boardNotes, shapes, sections, tabs, viewAsRoleId, updateStep, deleteStep, updateNote, deleteNote, handleShapeContentUpdate, handleSectionRename, setNodes]);

  /* ── Waypoint handling ──────────────────────────────────────── */

  const waypointTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWaypointsChange = useCallback((edgeId: string, waypoints: { x: number; y: number }[]) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...(e.data || {}), waypoints } }
          : e
      )
    );
    if (waypointTimer.current) clearTimeout(waypointTimer.current);
    waypointTimer.current = setTimeout(() => {
      const raw = boardEdges.find((be) => be.id === edgeId);
      if (!raw) return;
      const currentStyle = (raw.style || {}) as Record<string, unknown>;
      void updateEdge(edgeId, {
        style: { ...currentStyle, waypoints: waypoints.length > 0 ? waypoints : undefined } as Record<string, unknown>,
      });
    }, 300);
  }, [boardEdges, updateEdge, setEdges]);

  const handleLabelChange = useCallback((edgeId: string, text: string) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, data: { ...(e.data || {}), label: text || undefined, userLabel: text || null } }
          : e
      )
    );
    void updateEdge(edgeId, { label: text || null });
  }, [updateEdge, setEdges]);

  /* ── Build edges ───────────────────────────────────────────── */

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
      const labelBold = !!style.labelBold;
      const labelBgColor = (style.labelBgColor as string) || '';
      const waypoints = Array.isArray(style.waypoints) ? style.waypoints as { x: number; y: number }[] : [];
      const edgeType = (style.edgeType as string) || 'bezier';

      const resolveSource = () => {
        if (!e.source_shape_id) return `step-${e.source_step_id}`;
        if (boardNotes.some((n) => n.id === e.source_shape_id)) return `note-${e.source_shape_id}`;
        return `shape-${e.source_shape_id}`;
      };
      const resolveTarget = () => {
        if (!e.target_shape_id) return `step-${e.target_step_id}`;
        if (boardNotes.some((n) => n.id === e.target_shape_id)) return `note-${e.target_shape_id}`;
        return `shape-${e.target_shape_id}`;
      };
      const source = resolveSource();
      const target = resolveTarget();

      const userLabel = e.label || '';
      const edgeFlow = flowByEdge?.get(e.id);
      const flowLabel = edgeFlow && edgeFlow > 0 ? formatCount(edgeFlow) : '';
      const displayLabel = userLabel
        ? (flowLabel ? `${userLabel}  ·  ${flowLabel}` : userLabel)
        : (flowLabel || undefined);

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
          userLabel: userLabel || null,
          color: strokeColor, strokeWidth, dashed,
          animated: e.animated || false, arrowDir,
          labelFontSize, labelColor, labelBold, labelBgColor,
          edgeType,
          waypoints,
          onWaypointsChange: handleWaypointsChange,
          onLabelChange: handleLabelChange,
        },
      } as Edge;
    });
    setEdges(flow);
  }, [boardEdges, boardNotes, setEdges, flowByEdge, handleWaypointsChange, handleLabelChange]);

  /* ── Drag save ─────────────────────────────────────────────── */

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) {
      await updateNote(nodeId.replace('note-', ''), { board_x: x, board_y: y });
    } else if (nodeId.startsWith('shape-')) {
      await updateShape(nodeId.replace('shape-', ''), { x, y });
    } else if (nodeId.startsWith('section-')) {
      await updateSection(nodeId.replace('section-', ''), { x, y });
    } else if (nodeId.startsWith('step-')) {
      await updateStep(nodeId.replace('step-', ''), { board_x: x, board_y: y });
    }
  }, [updateNote, updateShape, updateSection, updateStep]);

  /* ── Section drag carries its contents ──────────────────────────
   *
   *  Sections aren't React Flow parents (that would make child coordinates
   *  relative, and board_x/board_y are absolute everywhere else), so moving a
   *  section has to move the nodes inside it by hand. Membership is captured
   *  once at drag start — nodes that happen to slide under the section
   *  mid-drag are not swept up.
   */
  const sectionDragRef = useRef<{
    origin: { x: number; y: number };
    members: { id: string; x: number; y: number }[];
  } | null>(null);

  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    if (!node.id.startsWith('section-')) { sectionDragRef.current = null; return; }
    const sectionId = node.id.replace('section-', '');
    const section = sections.find((s) => s.id === sectionId);
    if (!section) { sectionDragRef.current = null; return; }

    const bounds = { x: node.position.x, y: node.position.y, width: section.width, height: section.height };
    const members = nodes
      .filter((n) => n.id !== node.id && !n.id.startsWith('section-'))
      .filter((n) => nodeInSection(n.position, bounds))
      .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));

    sectionDragRef.current = { origin: { x: node.position.x, y: node.position.y }, members };
  }, [nodes, sections]);

  const onNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    const drag = sectionDragRef.current;
    if (!drag || !node.id.startsWith('section-')) return;
    const dx = node.position.x - drag.origin.x;
    const dy = node.position.y - drag.origin.y;
    if (dx === 0 && dy === 0) return;
    const byId = new Map(drag.members.map((m) => [m.id, m]));
    setNodes((nds) => nds.map((n) => {
      const start = byId.get(n.id);
      return start ? { ...n, position: { x: start.x + dx, y: start.y + dy } } : n;
    }));
  }, [setNodes]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    const drag = sectionDragRef.current;
    sectionDragRef.current = null;
    if (!drag || !node.id.startsWith('section-')) return;
    const dx = node.position.x - drag.origin.x;
    const dy = node.position.y - drag.origin.y;
    if (dx === 0 && dy === 0) return;
    // Persist every member's new home. The section's own position is saved by
    // onNodesChange's drag-end path, same as any other node.
    for (const m of drag.members) {
      void saveNodePosition(m.id, m.x + dx, m.y + dy);
    }
  }, [saveNodePosition]);

  const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPositions = useCallback(() => {
    const batch = new Map(pendingPositions.current);
    pendingPositions.current.clear();
    batch.forEach(({ x, y }, nodeId) => void saveNodePosition(nodeId, x, y));
  }, [saveNodePosition]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const dragEndIds = new Set<string>();
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) {
        dragEndIds.add(c.id);
      }
      // NodeResizer emits dimension changes; persist the section's new box once
      // the user lets go.
      if (c.type === 'dimensions' && c.resizing === false && c.id.startsWith('section-')) {
        const dims = (c as NodeChange & { dimensions?: { width: number; height: number } }).dimensions;
        if (dims) {
          void updateSection(c.id.replace('section-', ''), {
            width: Math.round(dims.width), height: Math.round(dims.height),
          });
        }
      }
    }

    setNodes((nds) => {
      let updated = applyNodeChanges(changes, nds);
      if (dragEndIds.size === 0) return updated;

      for (const id of Array.from(dragEndIds)) {
        const node = updated.find((n) => n.id === id);
        if (!node) continue;
        // Sections are backdrops — snapping them to node edges fights the user.
        const snapped = id.startsWith('section-')
          ? null
          : computeSnapPosition(node, updated, ALIGNMENT_TOLERANCE, visualCentre, 4);
        const finalPos = snapped || node.position;
        if (snapped) {
          updated = updated.map((n) => n.id === id ? { ...n, position: snapped } : n);
        }
        pendingPositions.current.set(id, finalPos);
      }
      return updated;
    });

    if (dragEndIds.size > 0) {
      if (positionTimer.current) clearTimeout(positionTimer.current);
      positionTimer.current = setTimeout(flushPositions, 250);
    }
  }, [flushPositions, setNodes, updateSection]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  /* ── Connect / delete / style ──────────────────────────────── */

  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return null;

    // RF node ids: steps use `step-{uuid}`, shapes `shape-{uuid}`, notes `note-{uuid}`.
    // Split into step vs shape columns so FK cascades behave correctly.
    // Note edges are persisted via the shape FK columns (source_shape_id / target_shape_id).
    const resolveId = (rfId: string) => {
      if (rfId.startsWith('step-'))  return { stepId: rfId.slice(5), shapeId: null, noteId: null };
      if (rfId.startsWith('shape-')) return { stepId: null, shapeId: rfId.slice(6), noteId: null };
      if (rfId.startsWith('note-'))  return { stepId: null, shapeId: null, noteId: rfId.slice(5) };
      return { stepId: rfId, shapeId: null, noteId: null };
    };
    const src = resolveId(connection.source);
    const tgt = resolveId(connection.target);

    return createEdge({
      funnel_id: ctx.funnelId,
      company_id: ctx.companyId,
      source_step_id: src.stepId,
      source_shape_id: src.shapeId || src.noteId,
      target_step_id: tgt.stepId,
      target_shape_id: tgt.shapeId || tgt.noteId,
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
      labelBold?: boolean; labelBgColor?: string;
      edgeType?: 'bezier' | 'straight' | 'step';
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
        const nextLabelBold = patch.labelBold !== undefined ? patch.labelBold : !!(currentData.labelBold as boolean);
        const nextLabelBgColor = patch.labelBgColor !== undefined ? patch.labelBgColor : ((currentData.labelBgColor as string) ?? '');
        const nextEdgeType = patch.edgeType ?? (currentData.edgeType as string) ?? 'bezier';
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
            labelBold: nextLabelBold, labelBgColor: nextLabelBgColor,
            edgeType: nextEdgeType,
          },
        };
        nextEdge = updated;
        return eds.map((e) => (e.id === edgeId ? updated : e));
      });
      setSelectedEdge((prev) => (prev && prev.id === edgeId && nextEdge ? nextEdge : prev));
      if (!nextEdge) return;
      const nextData = (nextEdge.data || {}) as Record<string, unknown>;
      const existingWaypoints = nextData.waypoints as { x: number; y: number }[] | undefined;
      await updateEdge(edgeId, {
        label: (nextData.label as string | null) ?? null,
        animated: nextEdge.animated ?? false,
        style: {
          stroke: nextEdge.style?.stroke,
          strokeWidth: nextEdge.style?.strokeWidth,
          dashed: nextData.dashed,
          arrowDir: nextData.arrowDir,
          labelFontSize: nextData.labelFontSize,
          labelColor: nextData.labelColor,
          labelBold: nextData.labelBold,
          labelBgColor: nextData.labelBgColor,
          edgeType: nextData.edgeType,
          ...(existingWaypoints?.length ? { waypoints: existingWaypoints } : {}),
        } as Record<string, unknown>,
      });
    },
    [updateEdge, setEdges]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => setSelectedEdge(edge), []);

  const onReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return;

      // Dragging an endpoint is a *move*, not a rebuild. The row is deleted and
      // recreated (the FK columns decide whether an end is a step or a shape,
      // so there's no in-place update), which means every styling field has to
      // be carried across by hand — otherwise label, colour, width, dashes,
      // arrows, waypoints and the split percentage all silently reset.
      const previous = boardEdges.find((e) => e.id === oldEdge.id);
      await deleteEdge(oldEdge.id);
      const created = await onConnect(newConnection);
      if (created && previous) {
        await updateEdge(created.id, {
          label: previous.label,
          animated: previous.animated,
          split_percent: previous.split_percent,
          style: previous.style,
        });
      }
    },
    [boardEdges, deleteEdge, onConnect, updateEdge]
  );

  return {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect, onReconnect, onEdgeClick,
    onNodeDragStart, onNodeDrag, onNodeDragStop,
    selectedEdge, handleUpdateEdgeStyle, handleDeleteEdge,
    closeEdgeEditor: () => setSelectedEdge(null),
  };
}
