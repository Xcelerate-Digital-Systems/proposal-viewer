// components/admin/reviews/board/useReviewBoard.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { supabase, type ReviewItem, type ReviewBoardEdge, type ReviewBoardNote } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { type ReviewItemNodeData } from './nodes/ReviewItemNode';
import { NOTE_COLORS, type StickyNoteNodeData } from './nodes/StickyNoteNode';

/* ─── Debounce helper ──────────────────────────────────────────── */

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, delay]) as T;
}

/* ─── Hook ─────────────────────────────────────────────────────── */

interface UseReviewBoardOptions {
  projectId: string;
  companyId: string;
  items: ReviewItem[];
  onRefreshItems: () => void;
  onNavigateToItem: (itemId: string) => void;
}

export interface EdgeEditingState {
  edge: Edge | null;
  label: string;
  color: string;
  dashed: boolean;
  animated: boolean;
}

export function useReviewBoard({
  projectId,
  companyId,
  items,
  onRefreshItems,
  onNavigateToItem,
}: UseReviewBoardOptions) {
  const toast = useToast();
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [boardEdges, setBoardEdges] = useState<ReviewBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<ReviewBoardNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Edge editing state
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('');
  const [editingEdgeColor, setEditingEdgeColor] = useState('#94a3b8');
  const [editingEdgeDashed, setEditingEdgeDashed] = useState(false);
  const [editingEdgeAnimated, setEditingEdgeAnimated] = useState(false);

  // Items placed on board vs unplaced
  const placedItems = useMemo(() => items.filter((i) => i.board_x != null && i.board_y != null), [items]);
  const unplacedItems = useMemo(() => items.filter((i) => i.board_x == null || i.board_y == null), [items]);

  /* ─── Edge click handler (passed into edge data) ───────────── */

  const handleEdgeClickFromData = useCallback((edgeId: string) => {
    setEdges((eds) => {
      const edge = eds.find((e) => e.id === edgeId);
      if (edge) {
        setSelectedEdge(edge);
        setEditingEdgeLabel((edge.label as string) || '');
        const style = edge.style as Record<string, unknown> | undefined;
        setEditingEdgeColor((style?.stroke as string) || '#94a3b8');
        setEditingEdgeDashed(!!edge.data?.dashed);
        setEditingEdgeAnimated(!!edge.animated);
      }
      return eds;
    });
  }, []);

  /* ─── Load board data ──────────────────────────────────────── */

  const loadBoardData = useCallback(async () => {
    const [edgesRes, notesRes] = await Promise.all([
      supabase
        .from('review_board_edges')
        .select('*')
        .eq('review_project_id', projectId),
      supabase
        .from('review_board_notes')
        .select('*')
        .eq('review_project_id', projectId),
    ]);

    setBoardEdges(edgesRes.data || []);
    setBoardNotes(notesRes.data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  /* ─── Build React Flow nodes from items + notes ────────────── */

  const handleNoteUpdate = useCallback(
    async (noteId: string, changes: Partial<ReviewBoardNote>) => {
      await supabase
        .from('review_board_notes')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', noteId);

      setBoardNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n))
      );
    },
    []
  );

  const handleNoteDelete = useCallback(
    async (noteId: string) => {
      await supabase.from('review_board_notes').delete().eq('id', noteId);
      setBoardNotes((prev) => prev.filter((n) => n.id !== noteId));
    },
    []
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
      } satisfies ReviewItemNodeData,
    }));

    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      data: {
        note,
        readOnly: false,
        onUpdate: handleNoteUpdate,
        onDelete: handleNoteDelete,
      } satisfies StickyNoteNodeData,
    }));

    setNodes([...itemNodes, ...noteNodes]);
  }, [placedItems, boardNotes, onNavigateToItem]);

  /* ─── Build React Flow edges from DB edges ─────────────────── */

  useEffect(() => {
    const flowEdges: Edge[] = boardEdges.map((e) => {
      const strokeColor = (e.style as Record<string, string>)?.stroke || '#94a3b8';
      const strokeWidth = Number((e.style as Record<string, number>)?.strokeWidth) || 2;
      const dashed = !!(e.style as Record<string, boolean>)?.dashed;

      return {
        id: e.id,
        source: e.source_item_id,
        target: e.target_item_id,
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
          onEdgeClick: handleEdgeClickFromData,
        },
      };
    });

    setEdges(flowEdges);
  }, [boardEdges, handleEdgeClickFromData]);

  /* ─── Save node positions (debounced) ──────────────────────── */

  const saveNodePosition = useCallback(async (nodeId: string, x: number, y: number) => {
    if (nodeId.startsWith('note-')) {
      const noteId = nodeId.replace('note-', '');
      await supabase
        .from('review_board_notes')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', noteId);
    } else {
      await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', nodeId);
    }
  }, []);

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
    [debouncedSavePosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  /* ─── Create edges ─────────────────────────────────────────── */

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const isNoteEdge = connection.source.startsWith('note-') || connection.target.startsWith('note-');

      if (!isNoteEdge) {
        const { data, error } = await supabase
          .from('review_board_edges')
          .insert({
            review_project_id: projectId,
            company_id: companyId,
            source_item_id: connection.source,
            target_item_id: connection.target,
            source_handle: connection.sourceHandle || 'right',
            target_handle: connection.targetHandle || 'left',
            edge_type: 'labeled',
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          })
          .select()
          .single();

        if (error) {
          toast.error('Failed to create connection');
          return;
        }

        if (data) {
          setBoardEdges((prev) => [...prev, data]);
        }
      } else {
        const newEdge: Edge = {
          id: `temp-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          type: 'labeled',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
            width: 16,
            height: 16,
          },
          data: {
            color: '#94a3b8',
            strokeWidth: 2,
            onEdgeClick: handleEdgeClickFromData,
          },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [projectId, companyId, toast, handleEdgeClickFromData]
  );

  /* ─── Delete edge ──────────────────────────────────────────── */

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!edgeId.startsWith('temp-')) {
        await supabase.from('review_board_edges').delete().eq('id', edgeId);
        setBoardEdges((prev) => prev.filter((e) => e.id !== edgeId));
      }
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    []
  );

  /* ─── Save edge style ──────────────────────────────────────── */

  const handleSaveEdgeStyle = useCallback(
    async () => {
      if (!selectedEdge) return;

      const label = editingEdgeLabel.trim() || null;
      const color = editingEdgeColor;
      const dashed = editingEdgeDashed;
      const animated = editingEdgeAnimated;
      const styleObj = { stroke: color, strokeWidth: 2, dashed };

      if (!selectedEdge.id.startsWith('temp-')) {
        await supabase
          .from('review_board_edges')
          .update({
            label,
            animated,
            style: styleObj,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedEdge.id);

        setBoardEdges((prev) =>
          prev.map((e) =>
            e.id === selectedEdge.id
              ? { ...e, label, animated, style: styleObj as Record<string, unknown> }
              : e
          )
        );
      }

      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdge.id
            ? {
                ...e,
                animated,
                style: { stroke: color, strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color,
                  width: 16,
                  height: 16,
                },
                data: {
                  ...((e.data || {}) as Record<string, unknown>),
                  label: label || undefined,
                  color,
                  dashed,
                  animated,
                },
              }
            : e
        )
      );
      setSelectedEdge(null);
    },
    [selectedEdge, editingEdgeLabel, editingEdgeColor, editingEdgeDashed, editingEdgeAnimated]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setEditingEdgeLabel(((edge.data as Record<string, unknown>)?.label as string) || (edge.label as string) || '');
    const style = edge.style as Record<string, unknown> | undefined;
    setEditingEdgeColor((style?.stroke as string) || '#94a3b8');
    setEditingEdgeDashed(!!(edge.data as Record<string, unknown>)?.dashed);
    setEditingEdgeAnimated(!!edge.animated);
  }, []);

  /* ─── Place / remove items ──────────────────────────────────── */

  const handlePlaceItem = useCallback(
    async (itemId: string) => {
      const existingCount = placedItems.length;
      const x = 100 + (existingCount % 4) * 280;
      const y = 100 + Math.floor(existingCount / 4) * 220;

      const { error } = await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) {
        toast.error('Failed to place item on board');
        return;
      }
      onRefreshItems();
    },
    [placedItems.length, toast, onRefreshItems]
  );

  const handleRemoveFromBoard = useCallback(
    async (itemId: string) => {
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: null, board_y: null, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) {
        toast.error('Failed to remove item from board');
        return;
      }

      await supabase
        .from('review_board_edges')
        .delete()
        .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);

      onRefreshItems();
      loadBoardData();
    },
    [toast, onRefreshItems, loadBoardData]
  );

  /* ─── Sticky notes ─────────────────────────────────────────── */

  const handleAddNote = useCallback(async () => {
    const existingCount = boardNotes.length;
    const x = 50 + (existingCount % 3) * 240;
    const y = 400 + Math.floor(existingCount / 3) * 200;

    const { data, error } = await supabase
      .from('review_board_notes')
      .insert({
        review_project_id: projectId,
        company_id: companyId,
        content: '',
        color: NOTE_COLORS[existingCount % NOTE_COLORS.length].value,
        board_x: x,
        board_y: y,
        width: 200,
        height: 150,
        font_size: 14,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to add note');
      return;
    }

    setBoardNotes((prev) => [...prev, data]);
  }, [projectId, companyId, boardNotes.length, toast]);

  /* ─── Auto-arrange ─────────────────────────────────────────── */

  const handleAutoArrange = useCallback(async () => {
    const cols = 4;
    const xGap = 280;
    const yGap = 220;
    const startX = 80;
    const startY = 80;

    const updates: { id: string; x: number; y: number; isNote: boolean }[] = [];

    placedItems.forEach((item, i) => {
      const x = startX + (i % cols) * xGap;
      const y = startY + Math.floor(i / cols) * yGap;
      updates.push({ id: item.id, x, y, isNote: false });
    });

    const noteStartY = startY + (Math.ceil(placedItems.length / cols) + 1) * yGap;
    boardNotes.forEach((note, i) => {
      const x = startX + (i % cols) * 240;
      const y = noteStartY + Math.floor(i / cols) * 200;
      updates.push({ id: note.id, x, y, isNote: true });
    });

    await Promise.all(
      updates.map((u) =>
        u.isNote
          ? supabase.from('review_board_notes').update({ board_x: u.x, board_y: u.y }).eq('id', u.id)
          : supabase.from('review_items').update({ board_x: u.x, board_y: u.y }).eq('id', u.id)
      )
    );

    onRefreshItems();
    loadBoardData();
    toast.success('Board auto-arranged');
  }, [placedItems, boardNotes, onRefreshItems, loadBoardData, toast]);

  /* ─── Edge editing state (bundled for the editor component) ── */

  const edgeEditing: EdgeEditingState = {
    edge: selectedEdge,
    label: editingEdgeLabel,
    color: editingEdgeColor,
    dashed: editingEdgeDashed,
    animated: editingEdgeAnimated,
  };

  return {
    // Flow state
    nodes,
    edges,
    loading,

    // Derived
    placedItems,
    unplacedItems,
    boardNotes,

    // Node/edge change handlers
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeClick,

    // Edge editing
    edgeEditing,
    setEditingEdgeLabel,
    setEditingEdgeColor,
    setEditingEdgeDashed,
    setEditingEdgeAnimated,
    handleSaveEdgeStyle,
    handleDeleteEdge,
    closeEdgeEditor: () => setSelectedEdge(null),

    // Board operations
    handlePlaceItem,
    handleRemoveFromBoard,
    handleAddNote,
    handleNoteDelete,
    handleAutoArrange,
  };
}
