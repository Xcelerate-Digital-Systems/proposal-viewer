'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant,
  Panel, useReactFlow, useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes, type OnConnect, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Wand2 } from 'lucide-react';
import { supabase, type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { autoLayout } from '@/components/admin/shared/board-utils';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import SitemapPageNode, { type SitemapNodeData } from './SitemapPageNode';
import AddSitemapPageModal from './AddSitemapPageModal';

const nodeTypes: NodeTypes = {
  sitemapPage: SitemapPageNode,
};

interface SitemapViewProps {
  projectId: string;
  companyId: string;
  userId: string | null;
  items: FeedbackItem[];
  onRefresh: () => void;
  onNavigateToItem: (itemId: string) => void;
}

function buildNodesAndEdges(
  items: FeedbackItem[],
  commentCounts: Map<string, { total: number; unresolved: number }>,
  onNavigate: (id: string) => void,
  onAddChild: (parentId: string) => void,
  onUpdateStatus?: (itemId: string, status: FeedbackStatus) => void | Promise<void>,
): { nodes: Node[]; edges: Edge[] } {
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
      onAddChild,
      onUpdateStatus,
    };

    return {
      id: item.id,
      type: 'sitemapPage',
      position: { x: item.board_x ?? 0, y: item.board_y ?? 0 },
      data: nodeData,
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

function SitemapViewInner({
  projectId, companyId, userId, items, onRefresh, onNavigateToItem,
}: SitemapViewProps) {
  const toast = useToast();
  const { fitView } = useReactFlow();
  const [commentCounts, setCommentCounts] = useState<Map<string, { total: number; unresolved: number }>>(new Map());
  const [showAddPage, setShowAddPage] = useState(false);
  const [addPageParentId, setAddPageParentId] = useState<string | null>(null);
  const [layoutApplied, setLayoutApplied] = useState(false);

  // Fetch comment counts
  useEffect(() => {
    if (items.length === 0) return;
    (async () => {
      const { data: comments } = await supabase
        .from('review_comments')
        .select('review_item_id, resolved')
        .in('review_item_id', items.map((i) => i.id))
        .is('parent_comment_id', null);

      if (comments) {
        const counts = new Map<string, { total: number; unresolved: number }>();
        for (const c of comments) {
          const entry = counts.get(c.review_item_id) ?? { total: 0, unresolved: 0 };
          entry.total++;
          if (!c.resolved) entry.unresolved++;
          counts.set(c.review_item_id, entry);
        }
        setCommentCounts(counts);
      }
    })();
  }, [items]);

  const handleAddChild = useCallback((parentId: string) => {
    setAddPageParentId(parentId);
    setShowAddPage(true);
  }, []);

  const handleUpdateStatus = useCallback(async (itemId: string, status: FeedbackStatus) => {
    await supabase.from('review_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    onRefresh();
  }, [onRefresh]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildNodesAndEdges(items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus),
    [items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when items or comments change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(
      items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus,
    );

    setNodes((prev) => {
      return newNodes.map((nn) => {
        const existing = prev.find((p) => p.id === nn.id);
        if (existing) {
          return { ...nn, position: existing.position };
        }
        return nn;
      });
    });
    setEdges(newEdges);
  }, [items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus, setNodes, setEdges]);

  // Auto-layout on first load if no positions saved
  useEffect(() => {
    if (layoutApplied || items.length === 0) return;

    const hasPositions = items.some((i) => i.board_x != null && i.board_x !== 0);
    if (!hasPositions) {
      requestAnimationFrame(() => {
        applyAutoLayout();
        setLayoutApplied(true);
      });
    } else {
      setLayoutApplied(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const applyAutoLayout = useCallback(() => {
    setNodes((prev) => {
      setEdges((prevEdges) => {
        const positions = autoLayout(prev, prevEdges, 'TB');
        const updated = prev.map((n) => {
          const p = positions.get(n.id);
          return p ? { ...n, position: { x: p.x, y: p.y } } : n;
        });
        setNodes(updated);
        setTimeout(() => fitView({ padding: 0.2 }), 50);
        return prevEdges;
      });
      return prev;
    });
  }, [setNodes, setEdges, fitView]);

  // Save positions on drag end
  const handleNodeDragStop = useCallback(async (_: unknown, node: Node) => {
    await supabase
      .from('review_items')
      .update({ board_x: Math.round(node.position.x), board_y: Math.round(node.position.y) })
      .eq('id', node.id);
  }, []);

  // Reparent on edge connect
  const onConnect: OnConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const { error } = await supabase
      .from('review_items')
      .update({ parent_item_id: connection.source })
      .eq('id', connection.target);

    if (error) {
      toast.error('Failed to reparent page');
      return;
    }
    onRefresh();
  }, [toast, onRefresh]);

  const handlePageAdded = useCallback(() => {
    setShowAddPage(false);
    setAddPageParentId(null);
    onRefresh();
  }, [onRefresh]);

  return (
    <>
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          snapToGrid
          snapGrid={[20, 20]}
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

          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => { setAddPageParentId(null); setShowAddPage(true); }}
              >
                Add Page
              </Button>
              <button
                onClick={applyAutoLayout}
                className="w-8 h-8 rounded-lg bg-white border border-edge shadow-sm flex items-center justify-center text-faint hover:text-teal hover:border-teal transition-colors"
                title="Auto-layout"
              >
                <Wand2 size={14} />
              </button>
            </div>
          </Panel>

          {items.length === 0 && (
            <Panel position="top-center">
              <div className="mt-32 text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Plus size={20} className="text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-ink mb-1">No pages yet</h3>
                <p className="text-xs text-faint mb-4 max-w-[240px]">
                  Add pages to build your sitemap. Each page can be a live webpage or a Figma design.
                </p>
                <Button
                  size="sm"
                  onClick={() => { setAddPageParentId(null); setShowAddPage(true); }}
                >
                  Add First Page
                </Button>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {showAddPage && (
        <AddSitemapPageModal
          projectId={projectId}
          companyId={companyId}
          userId={userId}
          parentItemId={addPageParentId}
          nextSortOrder={items.length}
          items={items}
          onClose={() => { setShowAddPage(false); setAddPageParentId(null); }}
          onSuccess={handlePageAdded}
        />
      )}
    </>
  );
}

export default function SitemapView(props: SitemapViewProps) {
  return (
    <ReactFlowProvider>
      <SitemapViewInner {...props} />
    </ReactFlowProvider>
  );
}
