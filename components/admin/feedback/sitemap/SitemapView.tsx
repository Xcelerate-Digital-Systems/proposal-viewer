'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant,
  Panel, useReactFlow, useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes, type OnConnect, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Search } from 'lucide-react';
import { supabase, type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { autoLayout } from '@/components/admin/shared/board-utils';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import SitemapPageNode, { type SitemapNodeData } from './SitemapPageNode';
import AddSitemapPageModal from './AddSitemapPageModal';
import ScanSiteModal from './ScanSiteModal';

const nodeTypes: NodeTypes = {
  sitemapPage: SitemapPageNode,
};

interface SitemapViewProps {
  projectId: string;
  companyId: string;
  userId: string | null;
  rootDomain: string | null;
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
  // Find the root node — the homepage (page_path '/') or first item without a parent
  const rootItem = items.find((i) => i.page_path === '/') ??
    items.find((i) => !i.parent_item_id);
  const rootId = rootItem?.id ?? null;

  // Build effective parent map: orphan pages (no parent, not root) become children of root
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
      position: { x: 0, y: 0 },
      draggable: false,
      data: nodeData,
    };
  });

  const edges: Edge[] = [];
  effectiveParent.forEach((parentId, childId) => {
    edges.push({
      id: `e-${parentId}-${childId}`,
      source: parentId,
      target: childId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      type: 'smoothstep',
    });
  });

  return { nodes, edges };
}

function SitemapViewInner({
  projectId, companyId, userId, rootDomain, items, onRefresh, onNavigateToItem,
}: SitemapViewProps) {
  const toast = useToast();
  const { fitView } = useReactFlow();
  const [commentCounts, setCommentCounts] = useState<Map<string, { total: number; unresolved: number }>>(new Map());
  const [showAddPage, setShowAddPage] = useState(false);
  const [showScanSite, setShowScanSite] = useState(false);
  const [addPageParentId, setAddPageParentId] = useState<string | null>(null);

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

  // Always auto-layout: positions are derived from tree structure, never manual.
  // Runs on every items/comments change.
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(
      items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus,
    );

    const positions = autoLayout(newNodes, newEdges, 'TB', {
      nodesep: 40, ranksep: 80, nodeWidth: 180, nodeHeight: 160,
    });
    const positioned = newNodes.map((n) => {
      const p = positions.get(n.id);
      return p ? { ...n, position: { x: p.x, y: p.y } } : n;
    });

    setNodes(positioned);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [items, commentCounts, onNavigateToItem, handleAddChild, handleUpdateStatus, setNodes, setEdges, fitView]);

  // Reparent on edge connect — layout recalculates automatically via onRefresh
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
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
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

          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => { setAddPageParentId(null); setShowAddPage(true); }}
              >
                Add Page
              </Button>
              {rootDomain && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={Search}
                  onClick={() => setShowScanSite(true)}
                >
                  Scan Site
                </Button>
              )}
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
                  {rootDomain
                    ? 'Scan your site to auto-discover pages, or add them manually.'
                    : 'Add pages to build your sitemap. Each page can be a live webpage or a Figma design.'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {rootDomain && (
                    <Button
                      size="sm"
                      leftIcon={Search}
                      onClick={() => setShowScanSite(true)}
                    >
                      Scan Site
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={rootDomain ? 'outline' : 'primary'}
                    onClick={() => { setAddPageParentId(null); setShowAddPage(true); }}
                  >
                    Add Manually
                  </Button>
                </div>
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

      {showScanSite && rootDomain && (
        <ScanSiteModal
          projectId={projectId}
          companyId={companyId}
          userId={userId}
          rootDomain={rootDomain}
          existingItems={items}
          onClose={() => setShowScanSite(false)}
          onSuccess={() => {
            setShowScanSite(false);
            onRefresh();
          }}
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
