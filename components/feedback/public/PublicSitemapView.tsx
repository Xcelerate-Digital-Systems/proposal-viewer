'use client';

import { useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant,
  useReactFlow, useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';
import { autoLayout } from '@/components/admin/shared/board-utils';
import SitemapPageNode, { type SitemapNodeData } from '@/components/admin/feedback/sitemap/SitemapPageNode';

const nodeTypes: NodeTypes = {
  sitemapPage: SitemapPageNode,
};

interface PublicSitemapViewProps {
  items: FeedbackItem[];
  comments: FeedbackComment[];
  onSelectItem: (itemId: string) => void;
}

function buildPublicNodesAndEdges(
  items: FeedbackItem[],
  comments: FeedbackComment[],
  onNavigate: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const commentCounts = new Map<string, { total: number; unresolved: number }>();
  for (const c of comments) {
    if (c.parent_comment_id || !c.review_item_id) continue;
    const entry = commentCounts.get(c.review_item_id) ?? { total: 0, unresolved: 0 };
    entry.total++;
    if (!c.resolved) entry.unresolved++;
    commentCounts.set(c.review_item_id, entry);
  }

  const childCountMap = new Map<string, number>();
  for (const item of items) {
    if (item.parent_item_id) {
      childCountMap.set(item.parent_item_id, (childCountMap.get(item.parent_item_id) ?? 0) + 1);
    }
  }

  const nodes: Node[] = items.map((item) => {
    const cc = commentCounts.get(item.id) ?? { total: 0, unresolved: 0 };
    const nodeData: SitemapNodeData = {
      item,
      commentCount: cc.total,
      unresolvedCount: cc.unresolved,
      childCount: childCountMap.get(item.id) ?? 0,
      onNavigate,
    };

    return {
      id: item.id,
      type: 'sitemapPage',
      position: { x: item.board_x ?? 0, y: item.board_y ?? 0 },
      data: nodeData,
      draggable: false,
    };
  });

  const edges: Edge[] = items
    .filter((item) => item.parent_item_id)
    .map((item) => ({
      id: `e-${item.parent_item_id}-${item.id}`,
      source: item.parent_item_id!,
      target: item.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      type: 'smoothstep',
    }));

  return { nodes, edges };
}

function PublicSitemapInner({ items, comments, onSelectItem }: PublicSitemapViewProps) {
  const { fitView } = useReactFlow();

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildPublicNodesAndEdges(items, comments, onSelectItem),
    [items, comments, onSelectItem],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildPublicNodesAndEdges(items, comments, onSelectItem);
    setNodes(n);
  }, [items, comments, onSelectItem, setNodes]);

  const applyLayout = useCallback(() => {
    setNodes((prev) => {
      const positions = autoLayout(prev, edges, 'TB');
      const updated = prev.map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, position: { x: p.x, y: p.y } } : n;
      });
      setTimeout(() => fitView({ padding: 0.2 }), 50);
      return updated;
    });
  }, [edges, fitView, setNodes]);

  useEffect(() => {
    if (items.length === 0) return;
    const hasPositions = items.some((i) => i.board_x != null && i.board_x !== 0);
    if (!hasPositions) {
      requestAnimationFrame(applyLayout);
    }
  }, [items.length, applyLayout]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-white !border !border-edge !rounded-xl !shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}

export default function PublicSitemapView(props: PublicSitemapViewProps) {
  return (
    <ReactFlowProvider>
      <PublicSitemapInner {...props} />
    </ReactFlowProvider>
  );
}
