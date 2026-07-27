'use client';

import { useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant,
  useReactFlow, useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes, type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';
import { autoLayout } from '@/components/admin/shared/board-utils';
import SitemapPageNode, { type SitemapNodeData, NODE_W, NODE_H } from '@/components/admin/feedback/sitemap/SitemapPageNode';
import SitemapSectionNode, { type SitemapSectionData, SECTION_W, SECTION_H } from '@/components/admin/feedback/sitemap/SitemapSectionNode';
import SitemapEdge, { type SitemapEdgeData } from '@/components/admin/feedback/sitemap/SitemapEdge';

const nodeTypes: NodeTypes = {
  sitemapPage: SitemapPageNode,
  sitemapSection: SitemapSectionNode,
};

const edgeTypes: EdgeTypes = {
  sitemapEdge: SitemapEdge,
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

  const rootItem = items.find((i) => i.page_path === '/') ??
    items.find((i) => !i.parent_item_id);
  const rootId = rootItem?.id ?? null;

  const effectiveParent = new Map<string, string>();
  for (const item of items) {
    if (item.parent_item_id) {
      effectiveParent.set(item.id, item.parent_item_id);
    } else if (rootId && item.id !== rootId) {
      effectiveParent.set(item.id, rootId);
    }
  }

  const childCountMap = new Map<string, number>();
  effectiveParent.forEach((parentId) => {
    childCountMap.set(parentId, (childCountMap.get(parentId) ?? 0) + 1);
  });

  const nodes: Node[] = items.map((item) => {
    const isSection = item.type === 'section';

    if (isSection) {
      const sectionData: SitemapSectionData = {
        item,
        childCount: childCountMap.get(item.id) ?? 0,
      };
      return {
        id: item.id,
        type: 'sitemapSection',
        position: { x: 0, y: 0 },
        data: sectionData,
        draggable: false,
        width: SECTION_W,
        height: SECTION_H,
      };
    }

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
      position: { x: 0, y: 0 },
      data: nodeData,
      draggable: false,
      width: NODE_W,
      height: NODE_H,
    };
  });

  const edges: Edge[] = [];
  effectiveParent.forEach((parentId, childId) => {
    const edgeData: SitemapEdgeData = {
      sourceId: parentId,
      targetId: childId,
    };
    edges.push({
      id: `e-${parentId}-${childId}`,
      source: parentId,
      target: childId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      type: 'sitemapEdge',
      data: edgeData,
    });
  });

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
    const { nodes: n } = buildPublicNodesAndEdges(items, comments, onSelectItem);
    setNodes(n);
  }, [items, comments, onSelectItem, setNodes]);

  const applyLayout = useCallback(() => {
    setNodes((prev) => {
      const positions = autoLayout(prev, edges, 'TB', {
        nodesep: 60, ranksep: 100, nodeWidth: 180, nodeHeight: 160,
      });
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
    requestAnimationFrame(applyLayout);
  }, [items.length, applyLayout]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        defaultEdgeOptions={{ type: 'sitemapEdge', style: { stroke: '#94a3b8', strokeWidth: 2 } }}
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
