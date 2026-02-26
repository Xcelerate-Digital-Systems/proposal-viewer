// components/admin/reviews/board/ReviewBoard.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  StickyNote, Trash2, Loader2, LayoutGrid, MousePointer,
} from 'lucide-react';
import { supabase, type ReviewItem, type ReviewBoardEdge, type ReviewBoardNote } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import ReviewItemNode, { type ReviewItemNodeData } from './nodes/ReviewItemNode';
import StickyNoteNode, { NOTE_COLORS, type StickyNoteNodeData } from './nodes/StickyNoteNode';
import LabeledEdge from './edges/LabeledEdge';
import BoardSidebar from './BoardSidebar';

/* ─── Types ────────────────────────────────────────────────────── */

interface ReviewBoardProps {
  projectId: string;
  companyId: string;
  items: ReviewItem[];
  onRefreshItems: () => void;
  onNavigateToItem: (itemId: string) => void;
}

/* ─── Node & Edge type registries ──────────────────────────────── */

const nodeTypes: NodeTypes = {
  reviewItem: ReviewItemNode,
  stickyNote: StickyNoteNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

/* ─── Edge color presets ───────────────────────────────────────── */

const EDGE_COLORS = [
  { value: '#94a3b8', label: 'Gray' },
  { value: '#017C87', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
];

/* ─── Default edge style ───────────────────────────────────────── */

const defaultEdgeOptions = {
  type: 'labeled',
  animated: false,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#94a3b8',
    width: 16,
    height: 16,
  },
};

/* ─── Debounce helper ──────────────────────────────────────────── */

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, delay]) as T;
}

/* ─── Component ────────────────────────────────────────────────── */

export default function ReviewBoard({
  projectId,
  companyId,
  items,
  onRefreshItems,
  onNavigateToItem,
}: ReviewBoardProps) {
  const toast = useToast();
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [boardEdges, setBoardEdges] = useState<ReviewBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<ReviewBoardNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('');
  const [editingEdgeColor, setEditingEdgeColor] = useState('#94a3b8');
  const [editingEdgeDashed, setEditingEdgeDashed] = useState(false);
  const [editingEdgeAnimated, setEditingEdgeAnimated] = useState(false);
  const reactFlowRef = useRef<HTMLDivElement>(null);

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

      // Save to DB
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

      // Update local edges
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

  /* ─── Place item on board ──────────────────────────────────── */

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

  /* ─── Remove item from board ───────────────────────────────── */

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

  /* ─── Render ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Sidebar — unplaced items */}
      <BoardSidebar
        unplacedItems={unplacedItems}
        placedItems={placedItems}
        onPlaceItem={handlePlaceItem}
        onRemoveFromBoard={handleRemoveFromBoard}
      />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid
          snapGrid={[20, 20]}
          style={{ background: '#fafafa' }}
          deleteKeyCode={['Backspace', 'Delete']}
          onEdgesDelete={(deletedEdges) => {
            deletedEdges.forEach((e) => handleDeleteEdge(e.id));
          }}
          onNodesDelete={(deletedNodes) => {
            deletedNodes.forEach((n) => {
              if (n.id.startsWith('note-')) {
                handleNoteDelete(n.id.replace('note-', ''));
              } else {
                handleRemoveFromBoard(n.id);
              }
            });
          }}
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          <Controls
            showInteractive={false}
            className="!bg-white !border-gray-200 !shadow-sm !rounded-lg"
          />
          <MiniMap
            nodeClassName={(node) => {
              if (node.type === 'stickyNote') return 'fill-yellow-200';
              return 'fill-white stroke-gray-300';
            }}
            className="!bg-gray-50 !border-gray-200 !rounded-lg"
            zoomable
            pannable
          />

          {/* Top toolbar panel */}
          <Panel position="top-center">
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 shadow-sm px-2 py-1.5">
              <button
                onClick={handleAddNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Add sticky note"
              >
                <StickyNote size={14} />
                Add Note
              </button>

              <div className="w-px h-5 bg-gray-200" />

              <button
                onClick={handleAutoArrange}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Auto-arrange nodes"
              >
                <LayoutGrid size={14} />
                Auto Arrange
              </button>
            </div>
          </Panel>

          {/* Instructions panel (shown when board is empty) */}
          {placedItems.length === 0 && boardNotes.length === 0 && (
            <Panel position="top-center" className="!top-16">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-[#017C87]/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-[#017C87]" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Build your funnel board
                </p>
                <p className="text-xs text-gray-400">
                  Click &ldquo;Place on Board&rdquo; in the sidebar to add items, then drag to arrange and connect them to show the funnel flow.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* ─── Edge style editor popover ─── */}
        {selectedEdge && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSelectedEdge(null)} />
            <div className="absolute top-4 right-4 z-40 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-[280px]">
              <h4 className="text-xs font-semibold text-gray-700 mb-3">Edit Connection</h4>

              {/* Label */}
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Label
              </label>
              <input
                type="text"
                value={editingEdgeLabel}
                onChange={(e) => setEditingEdgeLabel(e.target.value)}
                placeholder="e.g. Clicks CTA, Submits form..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] mb-3"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdgeStyle();
                  if (e.key === 'Escape') setSelectedEdge(null);
                }}
              />

              {/* Color */}
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Color
              </label>
              <div className="flex items-center gap-1.5 mb-3">
                {EDGE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setEditingEdgeColor(c.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      editingEdgeColor === c.value ? 'border-gray-600 scale-110' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>

              {/* Style toggles */}
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEdgeDashed}
                    onChange={(e) => setEditingEdgeDashed(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#017C87] focus:ring-[#017C87]/20"
                  />
                  <span className="text-xs text-gray-600">Dashed</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEdgeAnimated}
                    onChange={(e) => setEditingEdgeAnimated(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#017C87] focus:ring-[#017C87]/20"
                  />
                  <span className="text-xs text-gray-600">Animated</span>
                </label>
              </div>

              {/* Preview line */}
              <div className="h-8 mb-3 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
                <svg width="120" height="20" viewBox="0 0 120 20">
                  <defs>
                    <marker
                      id="preview-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={editingEdgeColor} />
                    </marker>
                  </defs>
                  <line
                    x1="10"
                    y1="10"
                    x2="110"
                    y2="10"
                    stroke={editingEdgeColor}
                    strokeWidth="2"
                    strokeDasharray={editingEdgeDashed ? '6 3' : 'none'}
                    markerEnd="url(#preview-arrow)"
                  />
                </svg>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleDeleteEdge(selectedEdge.id)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEdge(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdgeStyle}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#017C87] hover:bg-[#01434A] rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}