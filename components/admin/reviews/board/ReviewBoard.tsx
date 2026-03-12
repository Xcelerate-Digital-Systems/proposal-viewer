// components/admin/reviews/board/ReviewBoard.tsx
'use client';

import { useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  StickyNote, Loader2, LayoutGrid, MousePointer,
} from 'lucide-react';
import { type ReviewItem } from '@/lib/supabase';
import ReviewItemNode from './nodes/ReviewItemNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import LabeledEdge from './edges/LabeledEdge';
import BoardSidebar from './BoardSidebar';
import EdgeStyleEditor from './EdgeStyleEditor';
import { useReviewBoard } from './useReviewBoard';

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

/* ─── Component ────────────────────────────────────────────────── */

export default function ReviewBoard({
  projectId,
  companyId,
  items,
  onRefreshItems,
  onNavigateToItem,
}: ReviewBoardProps) {
  const reactFlowRef = useRef<HTMLDivElement>(null);

  const board = useReviewBoard({
    projectId,
    companyId,
    items,
    onRefreshItems,
    onNavigateToItem,
  });

  if (board.loading) {
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
        unplacedItems={board.unplacedItems}
        placedItems={board.placedItems}
        onPlaceItem={board.handlePlaceItem}
        onRemoveFromBoard={board.handleRemoveFromBoard}
      />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowRef}>
        <ReactFlow
          nodes={board.nodes}
          edges={board.edges}
          onNodesChange={board.onNodesChange}
          onEdgesChange={board.onEdgesChange}
          onConnect={board.onConnect}
          onEdgeClick={board.onEdgeClick}
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
            deletedEdges.forEach((e) => board.handleDeleteEdge(e.id));
          }}
          onNodesDelete={(deletedNodes) => {
            deletedNodes.forEach((n) => {
              if (n.id.startsWith('note-')) {
                board.handleNoteDelete(n.id.replace('note-', ''));
              } else {
                board.handleRemoveFromBoard(n.id);
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
                onClick={board.handleAddNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Add sticky note"
              >
                <StickyNote size={14} />
                Add Note
              </button>

              <div className="w-px h-5 bg-gray-200" />

              <button
                onClick={board.handleAutoArrange}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Auto-arrange nodes"
              >
                <LayoutGrid size={14} />
                Auto Arrange
              </button>
            </div>
          </Panel>

          {/* Instructions panel (shown when board is empty) */}
          {board.placedItems.length === 0 && board.boardNotes.length === 0 && (
            <Panel position="top-center" className="!top-16">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 max-w-sm text-center">
                <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mx-auto mb-3">
                  <MousePointer size={18} className="text-teal" />
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

        {/* Edge style editor popover */}
        {board.edgeEditing.edge && (
          <EdgeStyleEditor
            label={board.edgeEditing.label}
            color={board.edgeEditing.color}
            dashed={board.edgeEditing.dashed}
            animated={board.edgeEditing.animated}
            onLabelChange={board.setEditingEdgeLabel}
            onColorChange={board.setEditingEdgeColor}
            onDashedChange={board.setEditingEdgeDashed}
            onAnimatedChange={board.setEditingEdgeAnimated}
            onSave={board.handleSaveEdgeStyle}
            onDelete={() => board.handleDeleteEdge(board.edgeEditing.edge!.id)}
            onClose={board.closeEdgeEditor}
          />
        )}
      </div>
    </div>
  );
}
