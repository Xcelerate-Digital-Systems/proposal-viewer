'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant,
  Panel, useReactFlow, useNodesState, useEdgesState,
  type Node, type Edge, type EdgeTypes, type NodeTypes, type OnConnect, type Connection,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Search, FolderPlus } from 'lucide-react';
import { supabase, type FeedbackItem, type FeedbackStatus, type FeedbackItemType } from '@/lib/supabase';
import type { SiblingSide, SiblingType } from './SitemapSiblingMenu';
import { treeLayout } from '@/components/admin/shared/board-utils';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import SitemapPageNode, { type SitemapNodeData, NODE_W, NODE_H } from './SitemapPageNode';
import SitemapSectionNode, { type SitemapSectionData, SECTION_W, SECTION_H } from './SitemapSectionNode';
import SitemapEdge, { type SitemapEdgeData } from './SitemapEdge';
import SitemapDropZones, { type DropZone, type SectionTarget } from './SitemapDropZones';
import AddSitemapPageModal from './AddSitemapPageModal';
import ScanSiteModal from './ScanSiteModal';

const nodeTypes: NodeTypes = {
  sitemapPage: SitemapPageNode,
  sitemapSection: SitemapSectionNode,
};

const edgeTypes: EdgeTypes = {
  sitemapEdge: SitemapEdge,
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

function getRootItem(items: FeedbackItem[]): FeedbackItem | undefined {
  return items.find((i) => i.page_path === '/') ?? items.find((i) => !i.parent_item_id);
}

function buildNodesAndEdges(
  items: FeedbackItem[],
  commentCounts: Map<string, { total: number; unresolved: number }>,
  onNavigate: (id: string) => void,
  onAddChild: (parentId: string) => void,
  onRenameSection: (itemId: string, title: string) => void,
  onDeleteSection: (itemId: string) => void,
  onAddSibling: (itemId: string, side: SiblingSide, type: SiblingType) => void,
  onMoveToParent: (itemId: string) => void,
  onUpdateStatus?: (itemId: string, status: FeedbackStatus) => void | Promise<void>,
): { nodes: Node[]; edges: Edge[] } {
  const rootItem = getRootItem(items);
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

  const itemMap = new Map(items.map((i) => [i.id, i]));

  const nodes: Node[] = items.map((item) => {
    const isSection = item.type === 'section';
    const parentItem = item.parent_item_id ? itemMap.get(item.parent_item_id) : null;
    const parentIsSection = parentItem?.type === 'section';

    if (isSection) {
      const sectionData: SitemapSectionData = {
        item,
        childCount: childCountMap.get(item.id) ?? 0,
        onAddChild,
        onRename: onRenameSection,
        onDelete: onDeleteSection,
        onAddSibling,
      };
      return {
        id: item.id,
        type: 'sitemapSection',
        position: { x: 0, y: 0 },
        draggable: true,
        data: sectionData,
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
      parentIsSection,
      onNavigate,
      onAddChild,
      onAddSibling,
      onMoveToParent: parentIsSection ? onMoveToParent : undefined,
      onUpdateStatus,
    };

    return {
      id: item.id,
      type: 'sitemapPage',
      position: { x: 0, y: 0 },
      draggable: true,
      data: nodeData,
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

function calculateDropZones(
  nodes: Node[],
  items: FeedbackItem[],
  draggingId: string,
): { zones: DropZone[]; sectionTargets: SectionTarget[] } {
  const rootItem = getRootItem(items);
  const rootId = rootItem?.id ?? null;

  const childrenByParent = new Map<string, FeedbackItem[]>();
  for (const item of items) {
    if (item.id === draggingId || item.id === rootId) continue;
    const parentId = item.parent_item_id || rootId;
    if (!parentId) continue;
    const arr = childrenByParent.get(parentId) ?? [];
    arr.push(item);
    childrenByParent.set(parentId, arr);
  }

  const zones: DropZone[] = [];

  childrenByParent.forEach((children, parentId) => {
    const sorted = [...children].sort((a, b) => a.sort_order - b.sort_order);
    const positioned = sorted.map((child) => {
      const node = nodes.find((n) => n.id === child.id);
      if (!node) return null;
      const w = (node as { width?: number }).width ?? NODE_W;
      const h = (node as { height?: number }).height ?? NODE_H;
      return { item: child, x: node.position.x, w, y: node.position.y, h };
    }).filter(Boolean) as { item: FeedbackItem; x: number; w: number; y: number; h: number }[];

    if (positioned.length === 0) return;

    const maxH = Math.max(...positioned.map((p) => p.h));
    const minY = Math.min(...positioned.map((p) => p.y));

    // Before first
    const first = positioned[0];
    zones.push({
      id: `dz-${parentId}-start`,
      parentId,
      x: first.x - 24,
      y: minY,
      height: maxH,
      sortOrder: first.item.sort_order - 1,
    });

    // Between each pair
    for (let i = 0; i < positioned.length - 1; i++) {
      const a = positioned[i];
      const b = positioned[i + 1];
      const midX = a.x + a.w + (b.x - (a.x + a.w)) / 2;
      zones.push({
        id: `dz-${parentId}-${i}`,
        parentId,
        x: midX,
        y: minY,
        height: maxH,
        sortOrder: (a.item.sort_order + b.item.sort_order) / 2,
      });
    }

    // After last
    const last = positioned[positioned.length - 1];
    zones.push({
      id: `dz-${parentId}-end`,
      parentId,
      x: last.x + last.w + 24,
      y: minY,
      height: maxH,
      sortOrder: last.item.sort_order + 1,
    });
  });

  const sectionTargets: SectionTarget[] = [];
  for (const n of nodes) {
    if (n.id === draggingId || n.type !== 'sitemapSection') continue;
    sectionTargets.push({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      w: (n as { width?: number }).width ?? SECTION_W,
      h: (n as { height?: number }).height ?? SECTION_H,
    });
  }

  return { zones, sectionTargets };
}

function findNearestZone(
  zones: DropZone[],
  cx: number,
  cy: number,
): DropZone | null {
  let nearest: DropZone | null = null;
  let minDist = 150;

  for (const zone of zones) {
    const zoneCenter = zone.y + zone.height / 2;
    const dist = Math.hypot(cx - zone.x, cy - zoneCenter);
    if (dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }

  return nearest;
}

function findSectionTarget(
  targets: SectionTarget[],
  cx: number,
  cy: number,
): string | null {
  const PAD = 40;
  for (const t of targets) {
    if (cx >= t.x - PAD && cx <= t.x + t.w + PAD && cy >= t.y - PAD && cy <= t.y + t.h + PAD) {
      return t.id;
    }
  }
  return null;
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

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropZones, setDropZones] = useState<DropZone[]>([]);
  const [sectionTargets, setSectionTargets] = useState<SectionTarget[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const activeZoneRef = useRef<DropZone | null>(null);
  const activeSectionRef = useRef<string | null>(null);

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

  const handleRenameSection = useCallback(async (itemId: string, title: string) => {
    await supabase.from('review_items')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    onRefresh();
  }, [onRefresh]);

  const handleDeleteSection = useCallback(async (itemId: string) => {
    const section = items.find((i) => i.id === itemId);
    if (!section) return;

    const children = items.filter((i) => i.parent_item_id === itemId);
    if (children.length > 0) {
      const parentId = section.parent_item_id || null;
      for (const child of children) {
        await supabase.from('review_items')
          .update({ parent_item_id: parentId, updated_at: new Date().toISOString() })
          .eq('id', child.id);
      }
    }

    const { error } = await supabase.from('review_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to delete section');
      return;
    }
    toast.success(`Deleted section "${section.title}"`);
    onRefresh();
  }, [items, toast, onRefresh]);

  const handleMoveToParent = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !item.parent_item_id) return;

    const parentSection = items.find((i) => i.id === item.parent_item_id);
    if (!parentSection) return;

    const newParentId = parentSection.parent_item_id || null;
    const { error } = await supabase.from('review_items')
      .update({ parent_item_id: newParentId, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to move item');
      return;
    }
    toast.success(`Moved "${item.title}" up one level`);
    onRefresh();
  }, [items, toast, onRefresh]);

  const handleAddSection = useCallback(async () => {
    const rootItem = getRootItem(items);
    const { error } = await supabase.from('review_items').insert({
      review_project_id: projectId,
      company_id: companyId,
      created_by: userId,
      title: 'New Section',
      type: 'section',
      status: 'internal_review',
      sort_order: items.length,
      parent_item_id: rootItem?.id || null,
    });
    if (error) {
      toast.error('Failed to add section');
      return;
    }
    onRefresh();
  }, [projectId, companyId, userId, items, toast, onRefresh]);

  const handleAddSibling = useCallback(async (itemId: string, side: SiblingSide, type: SiblingType) => {
    const referenceItem = items.find((i) => i.id === itemId);
    if (!referenceItem) return;

    const parentId = referenceItem.parent_item_id || null;
    const siblings = items.filter((i) =>
      (i.parent_item_id || null) === parentId && i.id !== itemId
    );
    const refOrder = referenceItem.sort_order;

    let newOrder: number;
    if (side === 'left') {
      const leftSiblings = siblings.filter((s) => s.sort_order < refOrder);
      const nearestLeft = leftSiblings.length > 0
        ? Math.max(...leftSiblings.map((s) => s.sort_order))
        : refOrder - 1;
      newOrder = (nearestLeft + refOrder) / 2;
    } else {
      const rightSiblings = siblings.filter((s) => s.sort_order > refOrder);
      const nearestRight = rightSiblings.length > 0
        ? Math.min(...rightSiblings.map((s) => s.sort_order))
        : refOrder + 1;
      newOrder = (refOrder + nearestRight) / 2;
    }

    if (type === 'webpage') {
      setAddPageParentId(parentId);
      setShowAddPage(true);
      return;
    }

    const { error } = await supabase.from('review_items').insert({
      review_project_id: projectId,
      company_id: companyId,
      created_by: userId,
      title: 'New Section',
      type: 'section' as FeedbackItemType,
      status: 'internal_review' as FeedbackStatus,
      sort_order: newOrder,
      parent_item_id: parentId,
    });
    if (error) {
      toast.error('Failed to add section');
      return;
    }
    onRefresh();
  }, [items, projectId, companyId, userId, toast, onRefresh]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildNodesAndEdges(items, commentCounts, onNavigateToItem, handleAddChild, handleRenameSection, handleDeleteSection, handleAddSibling, handleMoveToParent, handleUpdateStatus),
    [items, commentCounts, onNavigateToItem, handleAddChild, handleRenameSection, handleDeleteSection, handleAddSibling, handleMoveToParent, handleUpdateStatus],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Drag handlers for guided drop zones
  const handleNodeDragStart: OnNodeDrag = useCallback((_event, draggedNode) => {
    const rootItem = getRootItem(items);
    if (draggedNode.id === rootItem?.id) return;

    setDraggingId(draggedNode.id);
    const { zones, sectionTargets: secTargets } = calculateDropZones(nodes, items, draggedNode.id);
    setDropZones(zones);
    setSectionTargets(secTargets);
  }, [nodes, items]);

  const handleNodeDrag: OnNodeDrag = useCallback((_event, draggedNode) => {
    if (!draggingId) return;

    const dw = (draggedNode as { width?: number }).width ?? NODE_W;
    const dh = (draggedNode as { height?: number }).height ?? NODE_H;
    const cx = draggedNode.position.x + dw / 2;
    const cy = draggedNode.position.y + dh / 2;

    // Check section hover first
    const sectionId = findSectionTarget(sectionTargets, cx, cy);
    if (sectionId) {
      setActiveSectionId(sectionId);
      activeSectionRef.current = sectionId;
      setActiveZoneId(null);
      activeZoneRef.current = null;
      return;
    }

    setActiveSectionId(null);
    activeSectionRef.current = null;

    // Find nearest drop zone
    const nearest = findNearestZone(dropZones, cx, cy);
    setActiveZoneId(nearest?.id ?? null);
    activeZoneRef.current = nearest;
  }, [draggingId, dropZones, sectionTargets]);

  const handleNodeDragStop: OnNodeDrag = useCallback(async (_event, draggedNode) => {
    const zone = activeZoneRef.current;
    const sectionId = activeSectionRef.current;

    // Clear drag state
    setDraggingId(null);
    setDropZones([]);
    setSectionTargets([]);
    setActiveZoneId(null);
    setActiveSectionId(null);
    activeZoneRef.current = null;
    activeSectionRef.current = null;

    const draggedItem = items.find((i) => i.id === draggedNode.id);
    if (!draggedItem) { onRefresh(); return; }

    // Dropped on a section → reparent
    if (sectionId && sectionId !== draggedItem.parent_item_id) {
      const { error } = await supabase.from('review_items')
        .update({ parent_item_id: sectionId, updated_at: new Date().toISOString() })
        .eq('id', draggedNode.id);
      if (error) {
        toast.error('Failed to move item');
      } else {
        const sec = items.find((i) => i.id === sectionId);
        toast.success(`Moved "${draggedItem.title}" into "${sec?.title}"`);
      }
      onRefresh();
      return;
    }

    // Dropped on a zone → reorder/reparent to that level
    if (zone) {
      const updates: Record<string, unknown> = {
        sort_order: zone.sortOrder,
        updated_at: new Date().toISOString(),
      };

      const rootItem = getRootItem(items);
      const currentEffectiveParent = draggedItem.parent_item_id || rootItem?.id || null;
      if (zone.parentId !== currentEffectiveParent) {
        updates.parent_item_id = zone.parentId === rootItem?.id ? rootItem?.id : zone.parentId;
      }

      await supabase.from('review_items')
        .update(updates)
        .eq('id', draggedNode.id);
      onRefresh();
      return;
    }

    // No valid target → snap back
    onRefresh();
  }, [items, toast, onRefresh]);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildNodesAndEdges(
      items, commentCounts, onNavigateToItem, handleAddChild, handleRenameSection, handleDeleteSection, handleAddSibling, handleMoveToParent, handleUpdateStatus,
    );

    const positions = treeLayout(newNodes, newEdges, {
      horizontalGap: 40, verticalGap: 80, nodeWidth: 180, nodeHeight: 160,
    });
    const positioned = newNodes.map((n) => {
      const p = positions.get(n.id);
      return p ? { ...n, position: { x: p.x, y: p.y } } : n;
    });

    setNodes(positioned);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [items, commentCounts, onNavigateToItem, handleAddChild, handleRenameSection, handleDeleteSection, handleAddSibling, handleMoveToParent, handleUpdateStatus, setNodes, setEdges, fitView]);

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

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'sitemapPage') {
      onNavigateToItem(node.id);
    }
  }, [onNavigateToItem]);

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
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable
          nodesConnectable
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
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

          <Panel position="top-left">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => { setAddPageParentId(null); setShowAddPage(true); }}
              >
                Add Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={FolderPlus}
                onClick={handleAddSection}
              >
                Add Section
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

          {draggingId && (
            <SitemapDropZones
              zones={dropZones}
              activeZoneId={activeZoneId}
              sectionTargets={sectionTargets}
              activeSectionId={activeSectionId}
            />
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
