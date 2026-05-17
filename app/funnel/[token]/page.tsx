'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Controls, MiniMap,
  ConnectionMode, type NodeTypes, type EdgeTypes, type Node, type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Monitor, Workflow } from 'lucide-react';
import type {
  Funnel, FunnelStep, FunnelBoardEdge, FunnelBoardNote, FunnelBoardShape,
  FeedbackBoardShape, FeedbackBoardNote,
} from '@/lib/supabase';
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
import BoardSummary from '@/components/admin/funnels/board/BoardSummary';
import { computeForecast, formatCount } from '@/lib/funnel/forecast';

const nodeTypes: NodeTypes = {
  funnelStep: FunnelStepNode,
  stickyNote: StickyNoteNode,
  shape: ShapeNode,
};
const edgeTypes: EdgeTypes = { labeled: LabeledEdge };

export default function PublicFunnelPage({ params }: { params: { token: string } }) {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [boardEdges, setBoardEdges] = useState<FunnelBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FunnelBoardNote[]>([]);
  const [boardShapes, setBoardShapes] = useState<FunnelBoardShape[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { bgSecondary, sidebarText } = useBrandingColors(branding);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/funnel/${params.token}`, { cache: 'no-store' });
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }
        const data = await res.json();
        setFunnel(data.funnel);
        setSteps(data.steps || []);
        setBoardEdges(data.boardEdges || []);
        setBoardNotes(data.boardNotes || []);
        setBoardShapes(data.boardShapes || []);

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
        setNotFound(true);
        setLoading(false);
        setBrandingLoaded(true);
      }
    }
    load();
  }, [params.token]);

  useEffect(() => {
    if (funnel) document.title = funnel.name || 'Funnel';
    return () => { document.title = 'Funnel'; };
  }, [funnel]);

  const forecast = useMemo(
    () => computeForecast(steps, boardEdges, funnel?.forecast_period ?? 'total'),
    [steps, boardEdges, funnel?.forecast_period]
  );

  const nodes: Node[] = useMemo(() => {
    const stepNodes: Node[] = steps.map((step) => ({
      id: `step-${step.id}`,
      type: 'funnelStep',
      position: { x: step.board_x, y: step.board_y },
      data: {
        step,
        readOnly: true,
        forecastVisitors: forecast.visitorsByStep.get(step.id) ?? 0,
        forecastConversions: forecast.conversionsByStep.get(step.id) ?? 0,
        showMetricsOverride: false,
      },
      draggable: false, selectable: false, connectable: false,
    }));
    const noteNodes: Node[] = boardNotes.map((note) => ({
      id: `note-${note.id}`,
      type: 'stickyNote',
      position: { x: note.board_x, y: note.board_y },
      data: { note: note as unknown as FeedbackBoardNote, readOnly: true },
      draggable: false, selectable: false, connectable: false,
    }));
    const shapeNodes: Node[] = boardShapes.map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape',
      position: { x: shape.x, y: shape.y },
      data: { shape: shape as unknown as FeedbackBoardShape, readOnly: true },
      draggable: false, selectable: false, connectable: false,
    }));
    return [...stepNodes, ...noteNodes, ...shapeNodes];
  }, [steps, boardNotes, boardShapes, forecast]);

  const edges: Edge[] = useMemo(() => boardEdges.map((e) => {
    const style = (e.style || {}) as Record<string, unknown>;
    const strokeColor = (style.stroke as string) || '#2B2B2B';
    const strokeWidth = Number(style.strokeWidth) || 2;
    const dashed = !!style.dashed;
    const rawArrow = style.arrowDir as string | undefined;
    const arrowDir: 'none' | 'source' | 'target' | 'both' =
      rawArrow === 'none' || rawArrow === 'source' || rawArrow === 'both' ? rawArrow : 'target';
    const source = e.source_shape_id ? `shape-${e.source_shape_id}` : `step-${e.source_step_id}`;
    const target = e.target_shape_id ? `shape-${e.target_shape_id}` : `step-${e.target_step_id}`;

    // Same composite-label rule as the editor (minus the selection guard since
    // the public view doesn't allow editing).
    const flowCount = forecast.flowByEdge.get(e.id) ?? 0;
    const isStepEdge = !!e.source_step_id && !!e.target_step_id;
    const labelParts: string[] = [];
    if (e.label) labelParts.push(e.label);
    if (isStepEdge) {
      if (e.split_percent != null) labelParts.push(`${Math.round(e.split_percent)}%`);
      if (flowCount > 0) labelParts.push(formatCount(flowCount));
    }
    return {
      id: e.id,
      source, target,
      sourceHandle: e.source_handle || 'right',
      targetHandle: e.target_handle || 'left',
      type: 'labeled',
      animated: e.animated || false,
      style: { stroke: strokeColor, strokeWidth },
      markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor, width: 16, height: 16 },
      data: {
        label: labelParts.join(' · ') || undefined,
        color: strokeColor, strokeWidth, dashed,
        animated: e.animated || false, arrowDir,
        labelFontSize: Number(style.labelFontSize) || 16,
        labelColor: (style.labelColor as string) || '#2B2B2B',
      },
    } as Edge;
  }), [boardEdges, forecast]);

  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: '#0f0f0f' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading funnel…" />;

  if (notFound || !funnel) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Workflow size={24} className="text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700">Funnel not found</h2>
          <p className="text-sm text-gray-500 mt-2">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body, branding.font_sidebar]} />

      {/* Mobile — desktop required */}
      <div className="flex lg:hidden min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Monitor size={24} className="text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700">Desktop Required</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Please open this funnel on a desktop browser to view the full canvas.
          </p>
        </div>
      </div>

      {/* Desktop — read-only canvas */}
      <div className="hidden lg:flex h-dvh flex-col bg-gray-50 overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ backgroundColor: bgSecondary, borderBottom: `1px solid ${sidebarText}15` }}
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
                  className="text-[11px] mt-0.5 line-clamp-1"
                  style={{
                    color: `${sidebarText}99`,
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

        <div className="flex-1 min-h-0 bg-notebook relative">
          <div className="absolute top-3 left-3 z-10">
            <BoardSummary
              forecast={forecast}
              currency={funnel?.currency ?? 'USD'}
              period={funnel?.forecast_period ?? 'total'}
            />
          </div>
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
              proOptions={{ hideAttribution: true }}
            >
              <Controls
                showInteractive={false}
                className="!bg-white !border !border-edge !shadow-sm !rounded-lg"
              />
              <MiniMap
                nodeClassName={(node) => {
                  if (node.type === 'stickyNote') return 'fill-sticky-yellow';
                  if (node.type === 'shape') return 'fill-ink/40';
                  return 'fill-white stroke-ink/40';
                }}
                className="!bg-surface !border !border-edge !rounded-lg"
                style={{ width: 140, height: 90 }}
                zoomable
                pannable
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </>
  );
}
