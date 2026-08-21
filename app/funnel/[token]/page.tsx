'use client';

import { useState, useEffect, useMemo, useCallback, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap,
  ConnectionMode, type NodeTypes, type EdgeTypes, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Monitor, RefreshCw, ServerCrash, WifiOff, Workflow } from 'lucide-react';
import type {
  Funnel, FunnelStep, FunnelTab, FunnelBoardEdge, FunnelBoardNote, FunnelBoardShape,
  FunnelBoardSection, FunnelRole,
  FeedbackBoardShape, FeedbackBoardNote,
} from '@/lib/supabase';
import { computeForecast } from '@/lib/funnel/forecast';
import { formatCount } from '@/lib/funnel/forecast';
import { ForecastCtx } from '@/components/admin/funnels/board/ForecastContext';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { fontFamily } from '@/lib/google-fonts';
import FunnelStepNode from '@/components/admin/funnels/board/nodes/FunnelStepNode';
import StickyNoteNode from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import ShapeNode from '@/components/admin/feedback/board/nodes/ShapeNode';
import LabeledEdge from '@/components/admin/feedback/board/edges/LabeledEdge';
import FunnelTabBar from '@/components/admin/funnels/board/FunnelTabBar';
import SectionNode from '@/components/admin/funnels/board/nodes/SectionNode';
import ViewAsRoleMenu from '@/components/admin/funnels/board/ViewAsRoleMenu';

const nodeTypes: NodeTypes = {
  funnelStep: FunnelStepNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
  section: SectionNode,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

export default function PublicFunnelPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  return (
    <Suspense fallback={<div className="fixed inset-0" style={{ backgroundColor: 'transparent' }} />}>
      <PublicFunnelInner token={params.token} />
    </Suspense>
  );
}

function PublicFunnelInner({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [allSteps, setAllSteps] = useState<FunnelStep[]>([]);
  const [allBoardEdges, setAllBoardEdges] = useState<FunnelBoardEdge[]>([]);
  const [allBoardNotes, setAllBoardNotes] = useState<FunnelBoardNote[]>([]);
  const [allBoardShapes, setAllBoardShapes] = useState<FunnelBoardShape[]>([]);
  const [allBoardSections, setAllBoardSections] = useState<FunnelBoardSection[]>([]);
  const [roles, setRoles] = useState<FunnelRole[]>([]);
  const [viewAsRoleId, setViewAsRoleId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<FunnelTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  /** null = no error, 'not-found' = 404/invalid token, 'server' = 5xx, 'network' = fetch failed */
  const [errorKind, setErrorKind] = useState<'not-found' | 'server' | 'network' | null>(null);

  const { bgSecondary, sidebarText, palette } = useBrandingColors(branding);

  useEffect(() => {
    async function load() {
      setErrorKind(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/funnel/${token}`, { cache: 'no-store' });
        if (!res.ok) {
          setErrorKind(res.status >= 500 ? 'server' : 'not-found');
          setLoading(false);
          setBrandingLoaded(true);
          return;
        }
        const data = await res.json();
        setFunnel(data.funnel);
        setAllSteps(data.steps || []);
        setAllBoardEdges(data.boardEdges || []);
        setAllBoardNotes(data.boardNotes || []);
        setAllBoardShapes(data.boardShapes || []);
        setAllBoardSections(data.boardSections || []);
        setRoles(data.roles || []);
        const loadedTabs: FunnelTab[] = data.tabs || [];
        setTabs(loadedTabs);
        if (loadedTabs.length > 0) setActiveTabId(loadedTabs[0].id);

        if (data.funnel?.company_id) {
          const brandRes = await fetch(
            `/api/company/branding?company_id=${data.funnel.company_id}`,
            { cache: 'no-store' }
          );
          if (brandRes.ok) setBranding(await brandRes.json());
        }
        setBrandingLoaded(true);
        setLoading(false);
      } catch {
        setErrorKind('network');
        setLoading(false);
        setBrandingLoaded(true);
      }
    }
    load();
  }, [token]);

  useEffect(() => {
    if (funnel) document.title = funnel.name || 'Funnel';
    return () => { document.title = 'Funnel'; };
  }, [funnel]);

  const tabsEnabled = tabs.length > 0;

  const steps = useMemo(
    () => tabsEnabled ? allSteps.filter((s) => s.tab_id === activeTabId) : allSteps,
    [allSteps, activeTabId, tabsEnabled]
  );
  const boardEdges = useMemo(
    () => tabsEnabled ? allBoardEdges.filter((e) => e.tab_id === activeTabId) : allBoardEdges,
    [allBoardEdges, activeTabId, tabsEnabled]
  );
  const boardNotes = useMemo(
    () => tabsEnabled ? allBoardNotes.filter((n) => n.tab_id === activeTabId) : allBoardNotes,
    [allBoardNotes, activeTabId, tabsEnabled]
  );
  const boardShapes = useMemo(
    () => tabsEnabled ? allBoardShapes.filter((s) => s.tab_id === activeTabId) : allBoardShapes,
    [allBoardShapes, activeTabId, tabsEnabled]
  );
  const boardSections = useMemo(
    () => tabsEnabled ? allBoardSections.filter((s) => s.tab_id === activeTabId) : allBoardSections,
    [allBoardSections, activeTabId, tabsEnabled]
  );

  // Same forecast the admin board computes. Without this the viewer showed no
  // visitor counts, no flow labels, and — because the metrics row feeds into
  // node height — rendered nodes at a different height than the editor did.
  const forecast = useMemo(
    () => computeForecast(
      steps, boardEdges,
      funnel?.forecast_period ?? 'total',
      funnel?.default_deal_value ?? null,
      boardShapes,
    ),
    [steps, boardEdges, boardShapes, funnel?.forecast_period, funnel?.default_deal_value]
  );

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of steps) if (s.role_id) m.set(s.role_id, (m.get(s.role_id) ?? 0) + 1);
    for (const sh of boardShapes) if (sh.role_id) m.set(sh.role_id, (m.get(sh.role_id) ?? 0) + 1);
    return m;
  }, [steps, boardShapes]);

  const handleNavigateTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const nodes: Node[] = useMemo(() => {
    const roleById = new Map(roles.map((r) => [r.id, r]));

    const stepNodes: Node[] = steps.map((step) => ({
      id: `step-${step.id}`,
      type: 'funnelStep',
      position: { x: step.board_x, y: step.board_y },
      data: {
        step,
        readOnly: true,
        onNavigateTab: tabsEnabled ? handleNavigateTab : undefined,
        tabs: tabsEnabled ? tabs : undefined,
        role: step.role_id ? roleById.get(step.role_id) ?? null : null,
      },
      draggable: false, selectable: false, connectable: false,
    }));
    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      data: { note: note as unknown as FeedbackBoardNote, readOnly: true, description: note.description },
      draggable: false, selectable: false, connectable: false,
    }));
    const shapeNodes: Node[] = boardShapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      data: {
        shape: shape as unknown as FeedbackBoardShape,
        readOnly: true,
        linkedFunnelId: shape.linked_funnel_id,
        linkedTabId: shape.linked_tab_id,
        onNavigateTab: tabsEnabled ? handleNavigateTab : undefined,
        tabs: tabsEnabled ? tabs : undefined,
        description: shape.description,
        message: shape.message,
        role: shape.role_id ? roleById.get(shape.role_id) ?? null : null,
      },
      draggable: false, selectable: false, connectable: false,
    }));
    const sectionNodes: Node[] = boardSections.map((section) => ({
      id: `section-${section.id}`,
      type: 'section',
      position: { x: section.x, y: section.y },
      style: { width: section.width, height: section.height },
      zIndex: -1,
      data: { section, readOnly: true },
      draggable: false, selectable: false, connectable: false,
    }));

    // "View as" fades non-matching nodes. Sections and notes carry no owner so
    // they stay at full strength.
    const withDim = (list: Node[]) => !viewAsRoleId ? list : list.map((n) => {
      const roleId = n.type === 'funnelStep'
        ? (n.data as { step?: { role_id?: string | null } }).step?.role_id
        : (n.data as { shape?: { role_id?: string | null } }).shape?.role_id;
      return {
        ...n,
        style: {
          ...(n.style || {}),
          opacity: roleId === viewAsRoleId ? 1 : 0.25,
          transition: 'opacity 150ms',
        },
      };
    });

    return [...sectionNodes, ...withDim(stepNodes), ...noteNodes, ...withDim(shapeNodes)];
  }, [steps, boardNotes, boardShapes, boardSections, tabs, tabsEnabled, handleNavigateTab, viewAsRoleId, roles]);

  const noteIds = useMemo(() => new Set(boardNotes.map((n) => n.id)), [boardNotes]);

  const edges: Edge[] = useMemo(() => boardEdges.map((e) => {
    const style = (e.style || {}) as Record<string, unknown>;
    const strokeColor = (style.stroke as string) || '#2B2B2B';
    const strokeWidth = Number(style.strokeWidth) || 2;
    const dashed = !!style.dashed;
    const rawArrow = style.arrowDir as string | undefined;
    const arrowDir: 'none' | 'source' | 'target' | 'both' =
      rawArrow === 'none' || rawArrow === 'source' || rawArrow === 'both' ? rawArrow : 'target';
    // Note edges are persisted through the shape FK columns, so a
    // `*_shape_id` may address either a shape or a sticky note. Resolving it
    // as a shape unconditionally produces an id no node carries, and React
    // Flow silently drops the edge. Mirrors resolveSource/resolveTarget in
    // useFunnelBoard.
    const source = e.source_shape_id
      ? (noteIds.has(e.source_shape_id) ? `note-${e.source_shape_id}` : `shape-${e.source_shape_id}`)
      : `step-${e.source_step_id}`;
    const target = e.target_shape_id
      ? (noteIds.has(e.target_shape_id) ? `note-${e.target_shape_id}` : `shape-${e.target_shape_id}`)
      : `step-${e.target_step_id}`;

    return {
      id: e.id,
      source, target,
      sourceHandle: e.source_handle || 'right',
      targetHandle: e.target_handle || 'left',
      type: 'labeled',
      animated: e.animated || false,
      style: { stroke: strokeColor, strokeWidth },
      markerEnd: undefined,
      data: {
        label: (() => {
          const userLabel = e.label || '';
          const edgeFlow = forecast.flowByEdge.get(e.id);
          const flowLabel = edgeFlow && edgeFlow > 0 ? formatCount(edgeFlow) : '';
          if (userLabel) return flowLabel ? `${userLabel}  ·  ${flowLabel}` : userLabel;
          return flowLabel || undefined;
        })(),
        color: strokeColor, strokeWidth, dashed,
        animated: e.animated || false, arrowDir,
        labelFontSize: Number(style.labelFontSize) || 16,
        labelColor: (style.labelColor as string) || '#2B2B2B',
        labelBold: !!style.labelBold,
        labelBgColor: (style.labelBgColor as string) || '',
        edgeType: (style.edgeType as string) || 'bezier',
        waypoints: Array.isArray(style.waypoints) ? style.waypoints as { x: number; y: number }[] : [],
      },
    } as Edge;
  }), [boardEdges, noteIds, forecast]);

  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: 'transparent' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading funnel…" />;

  if (errorKind === 'not-found' || (!loading && !funnel) || !funnel) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-faint" />
          </div>
          <h2 className="text-base font-semibold text-prose">This funnel link is no longer valid</h2>
          <p className="text-sm text-dim mt-2 leading-relaxed">
            The link may have expired or been revoked. Please contact the person who shared it to request a new one.
          </p>
        </div>
      </div>
    );
  }

  if (errorKind === 'server') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <ServerCrash size={24} className="text-faint" />
          </div>
          <h2 className="text-base font-semibold text-prose">Something went wrong on our end</h2>
          <p className="text-sm text-dim mt-2 leading-relaxed">
            We ran into an unexpected error loading this funnel. Please try again in a moment.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-teal-hover transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (errorKind === 'network') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <WifiOff size={24} className="text-faint" />
          </div>
          <h2 className="text-base font-semibold text-prose">Unable to connect</h2>
          <p className="text-sm text-dim mt-2 leading-relaxed">
            We couldn&apos;t reach the server. Check your internet connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-teal-hover transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Mobile — desktop required (hidden in embed mode) */}
      {!isEmbed && (
        <div className="flex lg:hidden min-h-screen items-center justify-center bg-surface p-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
              <Monitor size={24} className="text-faint" />
            </div>
            <h2 className="text-base font-semibold text-prose">Desktop Required</h2>
            <p className="text-sm text-dim mt-2 leading-relaxed">
              Please open this funnel on a desktop browser to view the full canvas.
            </p>
          </div>
        </div>
      )}

      {/* Desktop — read-only canvas (full-screen in embed mode) */}
      <div className={`${isEmbed ? 'flex' : 'hidden lg:flex'} h-dvh flex-col bg-surface overflow-hidden`}>
        {!isEmbed && (
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ backgroundColor: bgSecondary, borderBottom: `1px solid ${palette.borderSubtle}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.name} className="h-6 w-auto max-w-[120px] object-contain" />
              ) : branding.name ? (
                <span
                  className="text-sm font-semibold"
                  style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}
                >
                  {branding.name}
                </span>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Workflow size={16} className="text-teal" />
                </div>
              )}
              <div className="min-w-0">
                <h1
                  className="text-sm font-semibold truncate"
                  style={{ color: sidebarText, fontFamily: fontFamily(branding.font_heading) }}
                >
                  {funnel.name}
                </h1>
                {funnel.description && (
                  <p
                    className="text-detail mt-0.5 line-clamp-1"
                    style={{
                      color: palette.mutedText,
                      fontFamily: fontFamily(branding.font_sidebar),
                      fontWeight: branding.font_sidebar_weight || undefined,
                    }}
                  >
                    {funnel.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {tabsEnabled && (
          <FunnelTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={setActiveTabId}
            readOnly
          />
        )}

        <div className="flex-1 min-h-0 bg-notebook relative" role="region" aria-label={`${funnel.name} funnel canvas`}>
          {roles.length > 0 && (
            <div className="absolute top-3 right-3 z-10">
              <ViewAsRoleMenu
                roles={roles}
                viewAsRoleId={viewAsRoleId}
                onChange={setViewAsRoleId}
                countsByRole={roleCounts}
              />
            </div>
          )}
          <ForecastCtx.Provider value={forecast}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              style={{ background: 'transparent' }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              onlyRenderVisibleElements
              proOptions={{ hideAttribution: true }}
            >
              <Controls
                showInteractive={false}
                className="!bg-white/90 !border !border-edge/50 !shadow-none !rounded-lg !backdrop-blur-sm"
              />
              <MiniMap
                nodeClassName={(node) => {
                  if (node.type === 'section') return 'fill-teal/5 stroke-teal/20';
                  if (node.type === 'stickyNote') return 'fill-sticky-yellow';
                  if (node.type === 'shape') return 'fill-ink/40';
                  return 'fill-teal/15 stroke-teal/30';
                }}
                className="!bg-surface/90 !border !border-edge/50 !rounded-lg !backdrop-blur-sm"
                style={{ width: 180, height: 110 }}
                zoomable
                pannable
              />
            </ReactFlow>
          </ReactFlowProvider>
          </ForecastCtx.Provider>
        </div>
      </div>
    </>
  );
}
