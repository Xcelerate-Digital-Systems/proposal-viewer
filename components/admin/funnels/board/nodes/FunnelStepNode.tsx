'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Megaphone, Search, Mail, Link as LinkIcon, Monitor, BadgeDollarSign, UserPlus,
  CreditCard, Heart, TrendingUp, TrendingDown, Video, Package, GraduationCap,
  Briefcase, Gift, Square, Trash2, ExternalLink, Sparkles, Target, Globe,
  Smartphone, Phone, MessageSquare, Calendar, Zap, Flag, FileText, Image as ImageIcon,
  Music, Share2, Users, Mic, Star, Newspaper, BookOpen, Cloud, Repeat,
  Timer, Layers, UserCog, Ticket, Wrench, Building2, Hash,
  Bot, MapPin, QrCode, SquareUser, ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelStep } from '@/lib/supabase';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import { useFunnelBoardContext } from '../FunnelBoardContext';
import PageMockup, { PAGE_MOCKUP_W, PAGE_MOCKUP_H } from './PageMockup';

export interface FunnelStepNodeData extends Record<string, unknown> {
  step: FunnelStep;
  readOnly?: boolean;
  onUpdate?: (id: string, patch: Partial<FunnelStep>) => void;
  onDelete?: (id: string) => void;
  forecastVisitors?: number;
  forecastConversions?: number;
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
  'square-user': SquareUser,
  'qr-code': QrCode,
};

export const BRAND_SLUGS_SET = new Set([
  'facebook','instagram','google','youtube','tiktok','linkedin','pinterest',
  'twitter','snapchat','bing','reddit','stripe','mailchimp',
  'hubspot','ghl','activecampaign','salesforce','slack',
  'simpro','aroflo','workflowmax','servicem8','fergus','ascora','jobber',
  'messenger','chatbot',
  'zoho','yelp','amazon','zoom','gmail','spotify','google-maps',
]);

/** Lucide icon to render while a brand SVG is missing — keeps the canvas
 *  legible before /public/icons/brands/<slug>.svg files are dropped in.
 *  Each entry approximates the brand's mark visually. */
const BRAND_FALLBACK_LUCIDE: Record<string, LucideIcon> = {
  facebook: Megaphone, instagram: ImageIcon, google: Search, youtube: Video,
  tiktok: Music, linkedin: Briefcase, pinterest: ImageIcon, twitter: MessageSquare,
  snapchat: Smartphone, bing: Search, reddit: MessageSquare,
  stripe: CreditCard, mailchimp: Mail,
  hubspot: Target, ghl: Zap, activecampaign: Mail, salesforce: Cloud,
  slack: Hash,
  simpro: Wrench, aroflo: Wrench, workflowmax: Repeat, servicem8: Wrench,
  fergus: Wrench, ascora: Building2, jobber: Wrench,
  messenger: MessageSquare, chatbot: Bot,
  zoho: Briefcase, yelp: Star, amazon: ShoppingBag, zoom: Video,
  gmail: Mail, spotify: Music, 'google-maps': MapPin,
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

const FRAME_W = 200;
const ICON_SIZE = 88;
/** Single-line label container height. Labels truncate to one line, so 22px
 *  fits a 11px text glyph plus a couple of px breathing room. The old 56px
 *  value reserved empty whitespace below the text which inflated the gap
 *  between the label and the bottom-edge handle. */
const LABEL_OFFSET = 22;
const LABEL_GAP = 8;

// Handles anchored to the 88px circle (matches IconHandles geometry from
// the feedback board so funnel and feedback flow nodes align horizontally).
const HANDLE_BASE =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

function StepHandles({ readOnly }: { readOnly?: boolean }) {
  // Generous outset on top / sides so incoming horizontal + top edges have
  // breathing room around the disc. Bottom stays tight because the label
  // already sits right below; extra space there would just push the next
  // node further away.
  const sideOutset = 20;
  const bottomOutset = 8;
  const cy = ICON_SIZE / 2;
  const leftX = FRAME_W / 2 - ICON_SIZE / 2 - sideOutset;
  const rightX = FRAME_W / 2 + ICON_SIZE / 2 + sideOutset;
  const topY = -sideOutset;
  const bottomY = ICON_SIZE + LABEL_GAP + LABEL_OFFSET + bottomOutset;
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

/** Canonical centre Y shared across every node type (icon discs, diamonds,
 *  cards, sticky notes, and now page mockups). When two nodes are dropped at
 *  the same `board_y`, their visual centres land on the same canvas Y, so
 *  the connecting arrow draws as a perfectly straight horizontal line. */
const SHARED_SIDE_HANDLE_Y = 100;

/** Handles anchored to a page mockup that sits AT THE TOP of its frame
 *  (label below). Page is 200 tall, so its centre at frame-Y = 100 — exactly
 *  the canonical baseline. Top handle hangs above the page top edge; bottom
 *  handle clears the label entirely so the connection dot (and edge tip)
 *  doesn't overlap the label text. */
function PageHandles({ readOnly }: { readOnly?: boolean }) {
  const sideOutset = 20;
  const bottomOutset = 8;
  const leftX = FRAME_W / 2 - PAGE_MOCKUP_W / 2 - sideOutset;
  const rightX = FRAME_W / 2 + PAGE_MOCKUP_W / 2 + sideOutset;
  const topY = -sideOutset;
  const bottomY = PAGE_MOCKUP_H + LABEL_GAP + LABEL_OFFSET + bottomOutset;
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
  } = data as FunnelStepNodeData;
  const defaults = FUNNEL_STEP_DEFAULTS[step.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;
  const iconSlug = step.icon || defaults.icon;
  const tint = step.color || defaults.tint;

  const ctx = useFunnelBoardContext();
  const isSelected = selected || ctx?.selectedStepId === step.id;

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
  // Bodies sit at the TOP of the frame so vertical edges land directly on
  // the body edge with no whitespace gap above. Labels sit below the body
  // with LABEL_GAP padding above only — bottom handle sits just past the
  // label so the next node's connection feels close.
  //   - Disc: disc (88) + gap (8) + label (56) = 152
  //   - Page: page (200) + gap (8) + label (56) = 264
  const frameH = isPage
    ? PAGE_MOCKUP_H + LABEL_GAP + LABEL_OFFSET
    : ICON_SIZE + LABEL_GAP + LABEL_OFFSET;

  const labelEl = (
    <div className="flex items-start max-w-full px-1 w-full justify-center" style={{ height: LABEL_OFFSET }}>
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
          className="text-detail text-ink text-center bg-white border border-edge rounded px-1.5 py-0.5 outline-none focus:border-teal max-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
          className="block text-detail text-ink/80 text-center truncate max-w-[160px] leading-tight"
          title={step.label || defaults.label}
        >
          {step.label || defaults.label}
        </span>
      )}
    </div>
  );

  const pageBody = (
    <div onClick={handleBodyClick} className="group relative">
      <PageMockup stepType={step.step_type} tint={tint} selected={isSelected} />
      {!readOnly && (
        <div className="absolute inset-0 rounded-lg bg-ink/45 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {step.url && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              title="Open URL">
              <ExternalLink size={14} />
            </button>
          )}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(step.id); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
            title="Delete step">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const discBody = (
    <div
      onClick={handleBodyClick}
      className={`group relative flex items-center justify-center rounded-full shadow-[0_3px_8px_rgba(20,20,40,0.18)] transition-shadow ${
        isSelected ? 'ring-2 ring-teal ring-offset-2 ring-offset-white' : 'hover:shadow-lg'
      }`}
      style={{ width: ICON_SIZE, height: ICON_SIZE, backgroundColor: tint }}
    >
      <StepIcon slug={iconSlug} size={48} />
      {!readOnly && (
        <div className="absolute inset-0 rounded-full bg-ink/55 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {step.url && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              title="Open URL">
              <ExternalLink size={14} />
            </button>
          )}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(step.id); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
            title="Delete step">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isPage ? <PageHandles readOnly={readOnly} /> : <StepHandles readOnly={readOnly} />}
      <div
        className={`flex flex-col items-center ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ width: FRAME_W, height: frameH }}
        role="group"
        aria-label={step.label || defaults.label}
      >
        {/* Pages: body at top (centre at Y=100), label + metrics below.
            Discs: 56px empty space above keeps disc centred at Y=100,
            then disc, then label below — so vertical edges land on the
            disc's top edge without crossing the label text. */}
        {isPage ? (
          <>
            {pageBody}
            <div style={{ height: LABEL_GAP }} aria-hidden />
            {labelEl}

          </>
        ) : (
          <>
            {discBody}
            <div style={{ height: LABEL_GAP }} aria-hidden />
            {labelEl}

          </>
        )}
      </div>
    </>
  );
}

const FunnelStepNode = memo(FunnelStepNodeComponent);
FunnelStepNode.displayName = 'FunnelStepNode';
export default FunnelStepNode;
