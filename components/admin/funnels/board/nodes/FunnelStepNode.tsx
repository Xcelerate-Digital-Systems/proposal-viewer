'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Megaphone, Search, Mail, Link as LinkIcon, Monitor, BadgeDollarSign, UserPlus,
  CreditCard, Heart, TrendingUp, TrendingDown, Video, Package, GraduationCap,
  Briefcase, Gift, Square, Trash2, ExternalLink, Sparkles, Target, Globe,
  Smartphone, Phone, MessageSquare, Calendar, Zap, Flag, FileText, Image as ImageIcon,
  Music, Share2, Users, Mic, Star, Newspaper, BookOpen, Cloud, Repeat,
  Timer, Layers, UserCog, Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelStep } from '@/lib/supabase';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import { formatCount, formatMoney } from '@/lib/funnel/forecast';
import { useFunnelBoardContext } from '../FunnelBoardContext';
import PageMockup, { PAGE_MOCKUP_W, PAGE_MOCKUP_H } from './PageMockup';

export interface FunnelStepNodeData extends Record<string, unknown> {
  step: FunnelStep;
  readOnly?: boolean;
  onUpdate?: (id: string, patch: Partial<FunnelStep>) => void;
  onDelete?: (id: string) => void;
  /** Public viewer passes pre-computed forecast values (visitors / conversions
   *  / revenue / cost) per step since it can't access the editor context. */
  forecastVisitors?: number;
  forecastConversions?: number;
  showMetricsOverride?: boolean;
}

// Map icon slug → lucide component. Brand SVGs (facebook/google/etc.) are
// rendered from /public/icons/brands/ as <img>, see iconImgForSlug below.
export const LUCIDE: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  search: Search,
  mail: Mail,
  link: LinkIcon,
  monitor: Monitor,
  'badge-dollar': BadgeDollarSign,
  'user-plus': UserPlus,
  'credit-card': CreditCard,
  heart: Heart,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  video: Video,
  package: Package,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  gift: Gift,
  square: Square,
  sparkles: Sparkles,
  target: Target,
  globe: Globe,
  smartphone: Smartphone,
  phone: Phone,
  'message-square': MessageSquare,
  calendar: Calendar,
  zap: Zap,
  flag: Flag,
  'file-text': FileText,
  image: ImageIcon,
  music: Music,
  'share-2': Share2,
  users: Users,
  mic: Mic,
  star: Star,
  newspaper: Newspaper,
  'book-open': BookOpen,
  cloud: Cloud,
  repeat: Repeat,
  timer: Timer,
  layers: Layers,
  'user-cog': UserCog,
  ticket: Ticket,
  'external-link': ExternalLink,
};

export const BRAND_SLUGS_SET = new Set([
  'facebook','instagram','google','youtube','tiktok','linkedin','pinterest',
  'twitter','snapchat','bing','stripe','mailchimp',
]);

/** Lucide icon to render while a brand SVG is missing — keeps the canvas
 *  legible before /public/icons/brands/<slug>.svg files are dropped in.
 *  Each entry approximates the brand's mark visually. */
const BRAND_FALLBACK_LUCIDE: Record<string, LucideIcon> = {
  facebook: Megaphone, instagram: ImageIcon, google: Search, youtube: Video,
  tiktok: Music, linkedin: Briefcase, pinterest: ImageIcon, twitter: MessageSquare,
  snapchat: Smartphone, bing: Search, stripe: CreditCard, mailchimp: Mail,
};

export function StepIcon({ slug, size = 32 }: { slug: string; size?: number }) {
  const [brandFailed, setBrandFailed] = useState(false);

  if (BRAND_SLUGS_SET.has(slug) && !brandFailed) {
    // Brand SVG path. If the file isn't present yet, onError swaps to a
    // Lucide fallback so the canvas never shows a broken-image icon.
    return (
      <img
        src={`/icons/brands/${slug}.svg`}
        alt={slug}
        width={size}
        height={size}
        style={{ filter: 'brightness(0) invert(1)' }}
        onError={() => setBrandFailed(true)}
      />
    );
  }
  const Lc = brandFailed
    ? (BRAND_FALLBACK_LUCIDE[slug] || Square)
    : (LUCIDE[slug] || Square);
  return <Lc size={size} strokeWidth={1.8} className="text-white" />;
}

const FRAME_W = 240;
const ICON_SIZE = 88;
const LABEL_OFFSET = 56;
const SHELL_H = LABEL_OFFSET + ICON_SIZE;

// Handles anchored to the 88px circle (matches IconHandles geometry from
// the feedback board so funnel and feedback flow nodes align horizontally).
const HANDLE_BASE =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

function StepHandles({ readOnly }: { readOnly?: boolean }) {
  const outset = 14;
  const cy = LABEL_OFFSET + ICON_SIZE / 2;
  const leftX = FRAME_W / 2 - ICON_SIZE / 2 - outset;
  const rightX = FRAME_W / 2 + ICON_SIZE / 2 + outset;
  const topY = LABEL_OFFSET - outset;
  const bottomY = LABEL_OFFSET + ICON_SIZE + outset;
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: cy, right: FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ top: bottomY, bottom: 'auto' }} isConnectable={!readOnly} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ top: cy, left: leftX }} isConnectable={!readOnly} />
    </>
  );
}

/** Handles anchored to the 140×200 page mockup. Left/right Y is pinned to
 *  the canonical 100px baseline used by every other node type (icon discs,
 *  diamonds, sticky notes, feedback cards) so a step → page → step row
 *  produces straight horizontal arrows regardless of the type mix. Top and
 *  bottom hug the page edge. */
const SHARED_SIDE_HANDLE_Y = 100;

function PageHandles({ readOnly }: { readOnly?: boolean }) {
  const outset = 14;
  const leftX = FRAME_W / 2 - PAGE_MOCKUP_W / 2 - outset;
  const rightX = FRAME_W / 2 + PAGE_MOCKUP_W / 2 + outset;
  const topY = LABEL_OFFSET - outset;
  const bottomY = LABEL_OFFSET + PAGE_MOCKUP_H + outset;
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: SHARED_SIDE_HANDLE_Y, right: FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ top: bottomY, bottom: 'auto' }} isConnectable={!readOnly} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ top: SHARED_SIDE_HANDLE_Y, left: leftX }} isConnectable={!readOnly} />
    </>
  );
}

function FunnelStepNodeComponent({ data, selected }: NodeProps) {
  const {
    step, readOnly, onUpdate, onDelete,
    forecastVisitors, forecastConversions, showMetricsOverride,
  } = data as FunnelStepNodeData;
  const defaults = FUNNEL_STEP_DEFAULTS[step.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;
  const iconSlug = step.icon || defaults.icon;
  const tint = step.color || defaults.tint;

  const ctx = useFunnelBoardContext();
  const isSelected = selected || ctx?.selectedStepId === step.id;
  const showMetrics = showMetricsOverride ?? ctx?.showMetrics ?? true;
  const visitors = forecastVisitors ?? ctx?.forecast.visitorsByStep.get(step.id) ?? 0;
  const conversions = forecastConversions ?? ctx?.forecast.conversionsByStep.get(step.id) ?? 0;
  const value = step.metrics?.value ?? 0;
  const revenue = conversions * value;
  const hasMetrics =
    (step.metrics?.visitors != null) ||
    (step.metrics?.conversion_rate != null) ||
    (step.metrics?.value != null) ||
    (step.metrics?.cost != null) ||
    visitors > 0 || conversions > 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.label || defaults.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(step.label || defaults.label); }, [step.label, defaults.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || defaults.label;
    setEditing(false);
    if (next !== step.label) onUpdate?.(step.id, { label: next });
  };

  const handleBodyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    ctx?.selectStep(step.id);
  };

  const isPage = step.step_type.startsWith('page_');
  const bodyH = isPage ? PAGE_MOCKUP_H : ICON_SIZE;
  const frameH = LABEL_OFFSET + bodyH;

  return (
    <>
      {isPage ? <PageHandles readOnly={readOnly} /> : <StepHandles readOnly={readOnly} />}
      <div
        className={`flex flex-col items-center ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ width: FRAME_W, height: frameH }}
      >
        {/* Label */}
        <div className="h-14 flex items-start pt-2 max-w-full px-1 w-full justify-center">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(step.label || defaults.label); setEditing(false); }
              }}
              className="text-[11px] text-ink text-center bg-white border border-edge rounded px-1.5 py-0.5 outline-none focus:border-teal max-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
              className="block text-[11px] text-ink/80 text-center truncate max-w-[180px] leading-tight"
              title={readOnly ? undefined : 'Double-click to rename'}
            >
              {step.label || defaults.label}
            </span>
          )}
        </div>

        {/* Body — page mockup OR icon disc */}
        {isPage ? (
          <div onClick={handleBodyClick} className="group relative">
            <PageMockup stepType={step.step_type} tint={tint} selected={isSelected} />
            {!readOnly && (
              <div className="absolute inset-0 rounded-md bg-ink/45 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {step.url && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
                    className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                    title="Open URL"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(step.id); }}
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
                  title="Delete step"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={handleBodyClick}
            className={`group relative flex items-center justify-center rounded-full shadow-[0_3px_8px_rgba(20,20,40,0.18)] transition-shadow ${
              isSelected ? 'ring-2 ring-teal ring-offset-2 ring-offset-white' : 'hover:shadow-lg'
            }`}
            style={{ width: ICON_SIZE, height: ICON_SIZE, backgroundColor: tint }}
          >
            <StepIcon slug={iconSlug} />
            {!readOnly && (
              <div className="absolute inset-0 rounded-full bg-ink/55 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {step.url && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
                    className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                    title="Open URL"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(step.id); }}
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
                  title="Delete step"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Metrics strip */}
        {showMetrics && hasMetrics && (
          <div className="mt-2 px-2 py-1 rounded-md bg-white/95 border border-edge shadow-sm text-[10px] text-ink/80 leading-tight whitespace-nowrap">
            <span className="font-semibold text-ink">{formatCount(visitors)}</span>
            <span className="text-muted"> in</span>
            {(step.metrics?.conversion_rate ?? 0) > 0 && (
              <>
                <span className="text-muted"> · </span>
                <span>{(step.metrics?.conversion_rate ?? 0).toFixed(0)}%</span>
              </>
            )}
            {revenue > 0 && (
              <>
                <span className="text-muted"> · </span>
                <span className="text-emerald-600 font-semibold">{formatMoney(revenue)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const FunnelStepNode = memo(FunnelStepNodeComponent);
FunnelStepNode.displayName = 'FunnelStepNode';
export default FunnelStepNode;
