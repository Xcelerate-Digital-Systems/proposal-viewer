'use client';

import { memo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Megaphone, Search, Mail, Link as LinkIcon, Monitor, BadgeDollarSign, UserPlus,
  CreditCard, Heart, TrendingUp, TrendingDown, Video, Package, GraduationCap,
  Briefcase, Gift, Square, Trash2, ExternalLink, ArrowUpRight, Sparkles, Target, Globe,
  Smartphone, Phone, PhoneOutgoing, MessageSquare, Calendar, Zap, Flag, FileText, Image as ImageIcon,
  Music, Share2, Users, Mic, Star, Newspaper, BookOpen, Cloud, Repeat,
  Timer, Layers, UserCog, Ticket, Wrench, Building2, Hash,
  Bot, MapPin, QrCode, SquareUser, ShoppingBag,
  BadgeCheck, CheckCircle, Handshake, Rocket, Send, UserX,
  Diamond, Clock, CalendarDays, MousePointerClick, PlayCircle, ChevronsDown,
  ShoppingCart, BellRing, Bell, Sheet, Eye, LogOut, LogIn, Undo2, Download,
  Webhook, ClipboardCheck, CalendarCheck, Trophy, Crown, CircleX,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelStep, FunnelTab, FunnelRole } from '@/lib/supabase';
import {
  FUNNEL_STEP_DEFAULTS, messageKindForStep, parseNodeMessage, hasMessageContent,
} from '@/lib/types/funnel';
import RoleChip from './RoleChip';
import { formatCount } from '@/lib/funnel/forecast';
import { useFunnelBoardContext } from '../FunnelBoardContext';
import { useForecast } from '../ForecastContext';
import PageMockup, { PAGE_MOCKUP_W, PAGE_MOCKUP_H } from './PageMockup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import PlatformBadge from './PlatformBadge';

const NodeMessageModal = lazy(() => import('../NodeMessageModal'));

export interface FunnelStepNodeData extends Record<string, unknown> {
  step: FunnelStep;
  readOnly?: boolean;
  onUpdate?: (id: string, patch: Partial<FunnelStep>) => void;
  onDelete?: (id: string) => void;
  onNavigateTab?: (tabId: string) => void;
  tabs?: FunnelTab[];
  forecastVisitors?: number;
  forecastConversions?: number;
  /** Public viewer has no FunnelBoardProvider, so the resolved role is passed
   *  in directly. On the admin board this is omitted and looked up from
   *  context instead. */
  role?: FunnelRole | null;
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
  'badge-check': BadgeCheck,
  'check-circle': CheckCircle,
  handshake: Handshake,
  'phone-outgoing': PhoneOutgoing,
  rocket: Rocket,
  send: Send,
  'user-x': UserX,
  diamond: Diamond,
  clock: Clock,
  'calendar-days': CalendarDays,
  'mouse-pointer-click': MousePointerClick,
  'play-circle': PlayCircle,
  'chevrons-down': ChevronsDown,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'bell-ring': BellRing,
  bell: Bell,
  sheet: Sheet,
  eye: Eye,
  'log-out': LogOut,
  'log-in': LogIn,
  'undo-2': Undo2,
  download: Download,
  webhook: Webhook,
  'clipboard-check': ClipboardCheck,
  'calendar-check': CalendarCheck,
  trophy: Trophy,
  crown: Crown,
  'map-pin': MapPin,
  'circle-x': CircleX,
  chatbot: Bot,
};

/** Brands whose asset is a complete app icon — it ships with its own
 *  background (ServiceM8's green circle, AroFlo's dark tile, GoHighLevel's
 *  navy disc). These are rendered at FULL COLOUR filling the node, because
 *  flattening them to a white silhouette the way single-path marks are handled
 *  would turn every one of them into a featureless white blob.
 *
 *  Everything else in BRAND_SLUGS_SET is a single-path Simple Icons/SVGL mark
 *  and keeps the existing white-on-tint treatment. */
export const FULL_COLOUR_BRANDS = new Set([
  'ghl', 'servicem8', 'simpro', 'aroflo', 'fergus', 'workflowmax', 'ascora',
]);

/** File extension per brand asset. Explicit rather than probing .svg then
 *  falling back to .png, which would cost a 404 on every render. */
const BRAND_ASSET_EXT: Record<string, string> = {
  ghl: 'svg', servicem8: 'png', simpro: 'png', aroflo: 'png',
  fergus: 'png', workflowmax: 'png', ascora: 'png',
};

export function isFullColourBrand(slug: string): boolean {
  return FULL_COLOUR_BRANDS.has(slug);
}

export const BRAND_SLUGS_SET = new Set([
  'facebook','instagram','google','youtube','tiktok','linkedin','pinterest',
  'twitter','snapchat','bing','reddit','stripe','mailchimp',
  'hubspot','ghl','activecampaign','salesforce','slack',
  'simpro','aroflo','workflowmax','servicem8','fergus','ascora','jobber',
  'messenger','whatsapp',
  'zoho','yelp','amazon','zoom','gmail','spotify','google-maps',
  'ghl','servicem8','simpro','aroflo','fergus','workflowmax','ascora',
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
  messenger: MessageSquare, whatsapp: Phone, chatbot: Bot,
  zoho: Briefcase, yelp: Star, amazon: ShoppingBag, zoom: Video,
  gmail: Mail, spotify: Music, 'google-maps': MapPin,
};

/** Two-letter mark for a brand whose SVG isn't in /public/icons/brands yet.
 *  Clearer than an approximate Lucide glyph — "HS" reads as HubSpot, whereas
 *  the target icon it used to fall back to reads as nothing in particular. */
const BRAND_LETTERMARK: Record<string, string> = {
  hubspot: 'HS', ghl: 'HL', activecampaign: 'AC', salesforce: 'SF',
  simpro: 'SP', aroflo: 'AF', workflowmax: 'WM', servicem8: 'M8',
  fergus: 'FG', ascora: 'AS', jobber: 'JB', zoho: 'ZO', yelp: 'YP',
  amazon: 'AZ', zoom: 'ZM', gmail: 'GM', spotify: 'SP',
  'google-maps': 'GM', reddit: 'RD', slack: 'SL',
  messenger: 'MS', whatsapp: 'WA',
};

export function StepIcon({
  slug, size = 32, brandSize, fillContainer, onLightSurface,
}: {
  slug: string; size?: number; brandSize?: number; fillContainer?: boolean;
  /** Render dark instead of white. Brand SVGs are authored white-on-transparent
   *  for the coloured node discs; on a white surface (the platform badge) they
   *  need flipping back to dark or they vanish. */
  onLightSurface?: boolean;
}) {
  const [brandFailed, setBrandFailed] = useState(false);
  const bs = brandSize ?? size;

  // Reset on slug change: without this, one missing brand SVG poisoned the
  // component instance, so picking a brand that *does* have an asset kept
  // showing the fallback.
  useEffect(() => { setBrandFailed(false); }, [slug]);

  // Full-colour app icons: no white-out filter, and when the container asks for
  // it the logo covers the whole disc so the mark IS the node, Puzzle-style.
  // The container keeps its tint painted underneath, so a failed image load
  // degrades to the lettermark on a coloured disc rather than white-on-white.
  if (FULL_COLOUR_BRANDS.has(slug) && !brandFailed) {
    const ext = BRAND_ASSET_EXT[slug] || 'svg';
    return (
      <img
        src={`/icons/brands/${slug}.${ext}`}
        alt={slug}
        {...(fillContainer
          ? { className: 'w-full h-full object-cover' }
          : { width: bs, height: bs })}
        onError={() => setBrandFailed(true)}
      />
    );
  }

  if (BRAND_SLUGS_SET.has(slug) && !brandFailed) {
    return (
      <img
        src={`/icons/brands/${slug}.svg`}
        alt={slug}
        width={bs}
        height={bs}
        // brightness(0) alone gives a black silhouette; adding invert(1) takes
        // it back to white for the coloured discs.
        style={{ filter: onLightSurface ? 'brightness(0)' : 'brightness(0) invert(1)' }}
        onError={() => setBrandFailed(true)}
      />
    );
  }

  if (brandFailed && BRAND_LETTERMARK[slug]) {
    return (
      <span
        className={`font-bold leading-none select-none tracking-tight ${onLightSurface ? 'text-ink' : 'text-white'}`}
        style={{ fontSize: Math.round(bs * 0.42) }}
      >
        {BRAND_LETTERMARK[slug]}
      </span>
    );
  }

  const Lc = brandFailed
    ? (BRAND_FALLBACK_LUCIDE[slug] || Square)
    : (LUCIDE[slug] || Square);
  return <Lc size={size} strokeWidth={1.8} className={onLightSurface ? 'text-ink' : 'text-white'} />;
}

const FRAME_W = 200;
const ICON_SIZE = 88;
/** Label container height. Two-line clamp so longer names (e.g. "Google
 *  Search Ads") stay visible. 36px fits two lines of 11px text. */
const LABEL_OFFSET = 36;
const METRICS_H = 18;
const NAV_PILL_H = 26;
const DESC_CARD_MIN_H = 56;
const DESC_CARD_OVERLAP = 20;
const LABEL_GAP = 8;

// Handles anchored to the 88px circle (matches IconHandles geometry from
// the feedback board so funnel and feedback flow nodes align horizontally).
const HANDLE_BASE =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

function StepHandles({ readOnly }: { readOnly?: boolean; frameH?: number; hasDesc?: boolean }) {
  const sideOutset = 20;
  const cy = ICON_SIZE / 2;
  const leftX = FRAME_W / 2 - ICON_SIZE / 2 - sideOutset;
  const rightX = FRAME_W / 2 + ICON_SIZE / 2 + sideOutset;
  const topY = -sideOutset;
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: cy, right: FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ bottom: -8, top: 'auto' }} isConnectable={!readOnly} />
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
function PageHandles({ readOnly }: { readOnly?: boolean; frameH?: number; hasDesc?: boolean }) {
  const sideOutset = 20;
  const leftX = FRAME_W / 2 - PAGE_MOCKUP_W / 2 - sideOutset;
  const rightX = FRAME_W / 2 + PAGE_MOCKUP_W / 2 + sideOutset;
  const topY = -sideOutset;
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: SHARED_SIDE_HANDLE_Y, right: FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ bottom: -8, top: 'auto' }} isConnectable={!readOnly} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ top: SHARED_SIDE_HANDLE_Y, left: leftX }} isConnectable={!readOnly} />
    </>
  );
}

function FunnelStepNodeComponent({ data, selected }: NodeProps) {
  const {
    step, readOnly, onUpdate, onDelete, onNavigateTab, tabs, role: roleFromData,
  } = data as FunnelStepNodeData;
  const defaults = FUNNEL_STEP_DEFAULTS[step.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;
  const iconSlug = step.icon || defaults.icon;
  const tint = step.color || defaults.tint;

  const router = useRouter();
  const ctx = useFunnelBoardContext();
  const forecast = useForecast();
  const confirm = useConfirm();
  const isSelected = selected || ctx?.selectedStepId === step.id;
  const hasLinkedFunnel = !!step.linked_funnel_id;
  const hasLinkedTab = !!step.linked_tab_id;
  const hasLink = hasLinkedFunnel || hasLinkedTab;
  const role = roleFromData ?? ctx?.roles.find((r) => r.id === step.role_id) ?? null;

  const visitors = forecast?.visitorsByStep.get(step.id) ?? 0;
  const conversions = forecast?.conversionsByStep.get(step.id) ?? 0;
  const hasMetrics = visitors > 0;

  const [editing, setEditing] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
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

  /** Every other destructive action in the board confirms first; this one is a
   *  single click on a hover overlay, which is the easiest of all to hit by
   *  accident. */
  const confirmDelete = async () => {
    const ok = await confirm({
      title: `Delete "${step.label || defaults.label}"`,
      message: 'This removes the step and any connections to it.',
      confirmLabel: 'Delete step',
      destructive: true,
    });
    if (ok) onDelete?.(step.id);
  };

  const handleBodyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    ctx?.selectStep(step.id);
  };

  const linkedTabName = hasLinkedTab ? (tabs?.find((t) => t.id === step.linked_tab_id)?.name ?? null) : null;
  const showNavPill = hasLinkedTab || hasLinkedFunnel;

  const isPage = step.step_type.startsWith('page_');
  const hasDescription = !!step.description;

  // Email/SMS copy attached to this node. Adds its own pill row, so the frame
  // height has to grow with it or the bottom handle drifts off the node.
  const messageKind = messageKindForStep(step.step_type);
  const parsedMessage = messageKind ? parseNodeMessage(step.message) : null;
  const showMessagePill = !!parsedMessage && hasMessageContent(parsedMessage);

  const metricsRow = hasMetrics ? METRICS_H + 2 : 0;
  const navRow = (showNavPill ? NAV_PILL_H + 4 : 0) + (showMessagePill ? NAV_PILL_H + 4 : 0);
  const topH = isPage ? PAGE_MOCKUP_H : ICON_SIZE;

  const cardPadTop = DESC_CARD_OVERLAP + 4;
  const labelRow = 22;
  const descTextArea = hasDescription ? 56 + 10 : 0;
  const cardBottomPad = 10;
  const cardInner = cardPadTop + labelRow + metricsRow + navRow + descTextArea + cardBottomPad;
  const frameH = topH + Math.max(DESC_CARD_MIN_H, cardInner) - DESC_CARD_OVERLAP;

  const labelEl = (
    <div className="flex items-start max-w-full px-1 w-full justify-center py-0.5">
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
          className="block text-detail text-ink/80 text-center max-w-[180px] leading-tight line-clamp-2"
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
      {role && <RoleChip role={role} />}
      {step.platform && <PlatformBadge slug={step.platform} />}
      {hasLink && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-sm pointer-events-none z-10">
          {hasLinkedTab ? <Layers size={11} strokeWidth={2.5} /> : <ArrowUpRight size={11} strokeWidth={2.5} />}
        </div>
      )}
      {!readOnly && (
        <div className="absolute inset-0 rounded-lg bg-ink/45 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasLinkedTab && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); ctx?.switchTab(step.linked_tab_id!); onNavigateTab?.(step.linked_tab_id!); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-teal/80 flex items-center justify-center"
              title="Go to linked tab">
              <Layers size={14} />
            </button>
          )}
          {hasLinkedFunnel && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/funnels/${step.linked_funnel_id}`); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-teal/80 flex items-center justify-center"
              title="Go to linked funnel">
              <ArrowUpRight size={14} />
            </button>
          )}
          {step.url && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              title="Open URL">
              <ExternalLink size={14} />
            </button>
          )}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); void confirmDelete(); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
            title="Delete step">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );

  // A full-colour brand fills the disc entirely — the logo becomes the node.
  // The tint stays painted behind it purely as the fallback surface if the
  // image fails to load.
  const iconIsFullColour = isFullColourBrand(iconSlug);

  // The disc's hairline edge is an INSET ring rather than a border: a real
  // border would grow the box from 88px to 90px and shift every handle anchor
  // with it. It mostly earns its place on full-colour logos with pale
  // backgrounds, which otherwise float on the white canvas with no defined edge.
  const discBody = (
    <div
      onClick={handleBodyClick}
      className={`group relative flex items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(20,20,40,0.14),0_3px_8px_rgba(20,20,40,0.18)] transition-shadow ${
        isSelected ? 'ring-2 ring-teal ring-offset-2 ring-offset-white' : 'hover:shadow-lg'
      }`}
      style={{ width: ICON_SIZE, height: ICON_SIZE, backgroundColor: tint }}
    >
      {/* The clip lives on this inner wrapper, not the disc — the disc also
          holds the link badge and role chip, which deliberately overhang its
          edges and would be sliced off by overflow-hidden. */}
      <div className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center">
        <StepIcon slug={iconSlug} size={40} brandSize={36} fillContainer={iconIsFullColour} />
      </div>
      {role && <RoleChip role={role} />}
      {step.platform && <PlatformBadge slug={step.platform} />}
      {hasLink && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-sm pointer-events-none z-10">
          {hasLinkedTab ? <Layers size={11} strokeWidth={2.5} /> : <ArrowUpRight size={11} strokeWidth={2.5} />}
        </div>
      )}
      {!readOnly && (
        <div className="absolute inset-0 rounded-full bg-ink/55 text-white flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasLinkedTab && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); ctx?.switchTab(step.linked_tab_id!); onNavigateTab?.(step.linked_tab_id!); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-teal/80 flex items-center justify-center"
              title="Go to linked tab">
              <Layers size={14} />
            </button>
          )}
          {hasLinkedFunnel && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/funnels/${step.linked_funnel_id}`); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-teal/80 flex items-center justify-center"
              title="Go to linked funnel">
              <ArrowUpRight size={14} />
            </button>
          )}
          {step.url && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); window.open(step.url!, '_blank'); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              title="Open URL">
              <ExternalLink size={14} />
            </button>
          )}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); void confirmDelete(); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-rose-500/80 flex items-center justify-center"
            title="Delete step">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );

  // The preview modal rides along in this slot: it portals to document.body,
  // so it renders correctly from either layout branch below.
  const navPillEl = (showNavPill || showMessagePill) ? (
    <>
      {showNavPill && (
        <NavPill
          label={hasLinkedTab ? linkedTabName : 'Linked funnel'}
          icon={hasLinkedTab ? 'tab' : 'funnel'}
          onClick={() => {
            if (hasLinkedTab) {
              if (readOnly && onNavigateTab) onNavigateTab(step.linked_tab_id!);
              else { ctx?.switchTab(step.linked_tab_id!); onNavigateTab?.(step.linked_tab_id!); }
            } else if (hasLinkedFunnel) {
              router.push(`/funnels/${step.linked_funnel_id}`);
            }
          }}
        />
      )}
      {showMessagePill && parsedMessage && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMessageOpen(true); }}
          className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-edge text-ink/70 text-2xs font-medium shadow-sm hover:border-teal hover:text-teal transition-colors cursor-pointer"
          style={{ height: NAV_PILL_H }}
          title={parsedMessage.kind === 'email' ? 'View the email' : 'View the text message'}
        >
          {parsedMessage.kind === 'email'
            ? <Mail size={11} strokeWidth={2.5} />
            : <MessageSquare size={11} strokeWidth={2.5} />}
          <span>{parsedMessage.kind === 'email' ? 'View email' : 'View text'}</span>
        </button>
      )}
      {messageOpen && parsedMessage && (
        <Suspense fallback={null}>
          <NodeMessageModal
            message={parsedMessage}
            title={step.label || defaults.label}
            onClose={() => setMessageOpen(false)}
          />
        </Suspense>
      )}
    </>
  ) : null;

  return (
    <>
      {isPage ? <PageHandles readOnly={readOnly} frameH={frameH} hasDesc={hasDescription} /> : <StepHandles readOnly={readOnly} frameH={frameH} hasDesc={hasDescription} />}
      <div
        className={`flex flex-col items-center ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ width: FRAME_W, minHeight: frameH }}
        role="group"
        aria-label={step.label || defaults.label}
      >
        <div className="relative z-10">
          {isPage ? pageBody : discBody}
        </div>
        <div
          className="w-full bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.10)] border border-ink/15 flex flex-col items-center"
          style={{ marginTop: -DESC_CARD_OVERLAP, paddingTop: DESC_CARD_OVERLAP + 4, paddingBottom: cardBottomPad, minHeight: DESC_CARD_MIN_H }}
        >
          {labelEl}
          {hasMetrics && <MetricsBadge visitors={visitors} conversions={conversions} />}
          {navPillEl}
          {hasDescription && (
            <p className="text-2xs text-ink/55 leading-snug whitespace-pre-wrap px-3 pt-1 w-full text-center">
              {step.description}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function NavPill({ label, icon, onClick }: { label: string | null; icon?: 'tab' | 'funnel'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal text-white text-2xs font-medium shadow-sm hover:bg-teal-hover transition-colors cursor-pointer"
      style={{ height: NAV_PILL_H }}
      title={label ? `Go to ${label}` : icon === 'funnel' ? 'Go to linked funnel' : 'Go to linked tab'}
    >
      {icon === 'funnel' ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <Layers size={11} strokeWidth={2.5} />}
      <span className="truncate max-w-[120px]">{label || (icon === 'funnel' ? 'Linked funnel' : 'Linked tab')}</span>
    </button>
  );
}

function MetricsBadge({ visitors, conversions }: { visitors: number; conversions: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-0.5" style={{ height: METRICS_H }}>
      <span className="text-2xs text-muted tabular-nums">{formatCount(visitors)}</span>
      {conversions > 0 && conversions !== visitors && (
        <>
          <span className="text-2xs text-faint">→</span>
          <span className="text-2xs text-teal font-medium tabular-nums">{formatCount(conversions)}</span>
        </>
      )}
    </div>
  );
}

const FunnelStepNode = memo(FunnelStepNodeComponent);
FunnelStepNode.displayName = 'FunnelStepNode';
export default FunnelStepNode;
