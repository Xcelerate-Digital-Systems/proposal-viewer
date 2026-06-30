import {
  Clock, Phone, CalendarDays, Zap, Flag,
  MousePointerClick, FileText, PlayCircle, ChevronsDown,
  ShoppingCart, ShoppingBag, BellRing, Sparkles,
  MessageSquare, Mail, Bell, Sheet,
  Eye, Timer, LogOut, LogIn, Undo2, Download, Share2, Webhook,
  ClipboardCheck, CalendarCheck, Trophy, Target, Crown, MapPin, Send,
  Star, Gift,
  type LucideIcon,
} from 'lucide-react';
import type { FeedbackBoardShape } from '@/lib/supabase';

/* ─── Diamond geometry constants ─────────────────────────────────── */

export const DIAMOND_SIDE = 30;
export const DIAMOND_BOX_SIZE = 42;
export const DIAMOND_INSET = (DIAMOND_BOX_SIZE - DIAMOND_SIDE) / 2;
export const DIAMOND_LABEL_GAP = 8;
export const DIAMOND_LABEL_BELOW = 22;
export const DIAMOND_NODE_W = DIAMOND_BOX_SIZE;
export const DIAMOND_NODE_H = DIAMOND_BOX_SIZE + DIAMOND_LABEL_GAP + DIAMOND_LABEL_BELOW;

/* ─── Handle positioning constants ───────────────────────────────── */

export const HANDLE_CLASS =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

export const DIAMOND_TOP_Y = 0;
export const DIAMOND_MID_Y = DIAMOND_BOX_SIZE / 2;
export const DIAMOND_SIDE_OUTSET = 20;
export const HANDLE_OUTSET = 8;

/* ─── Legacy default colour ──────────────────────────────────────── */

/** Legacy default colour written when a shape is first created — primitive
 *  shapes (rect/ellipse/arrow/line/text) use it as their stroke, but the
 *  diamond-style shapes (decision/wait/event/action) get their colour from
 *  DIAMOND_CONFIG and treat this sentinel as "no override". */
export const LEGACY_DEFAULT_COLOR = '#2B2B2B';

export function diamondColorOverride(shape: FeedbackBoardShape): string | null {
  if (!shape.color || shape.color === LEGACY_DEFAULT_COLOR) return null;
  return shape.color;
}

/* ─── Diamond type registry ──────────────────────────────────────── */

export type DiamondType =
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'page_view' | 'time_on_page' | 'exit_intent' | 'refund'
  | 'download' | 'share' | 'login'
  | 'sms_notification' | 'email_notification' | 'ghl_notification'
  | 'google_sheet' | 'webhook'
  | 'form_completed' | 'schedule_meeting' | 'deal_won'
  | 'ghl_appointment' | 'ghl_order' | 'ghl_opportunity' | 'ghl_opportunity_won'
  | 'on_site_visit' | 'send_quote'
  | 'send_google_review' | 'add_to_referral_program';

export interface DiamondConfig {
  color: string;
  Icon: LucideIcon;
  typeLabel: string;
  placeholder: string;
}

export const DIAMOND_CONFIG: Record<DiamondType, DiamondConfig> = {
  // Events
  button_click: { color: '#3B82F6', Icon: MousePointerClick, typeLabel: 'Button Click', placeholder: 'Button click' },
  form_submit:  { color: '#06B6D4', Icon: FileText,          typeLabel: 'Form Submit',  placeholder: 'Form submit' },
  video_play:   { color: '#EF4444', Icon: PlayCircle,        typeLabel: 'Video Play',   placeholder: 'Video play' },
  scroll_depth: { color: '#6366F1', Icon: ChevronsDown,      typeLabel: 'Scroll',       placeholder: 'Scroll depth' },
  purchase:     { color: '#10B981', Icon: ShoppingBag,       typeLabel: 'Purchase',     placeholder: 'Purchase' },
  add_to_cart:  { color: '#F97316', Icon: ShoppingCart,      typeLabel: 'Add to Cart',  placeholder: 'Add to cart' },
  subscribe:    { color: '#EC4899', Icon: BellRing,          typeLabel: 'Subscribe',    placeholder: 'Subscribe' },
  custom_event: { color: '#64748B', Icon: Sparkles,          typeLabel: 'Event',        placeholder: 'Custom event' },
  // Existing action types — re-skinned as diamonds
  call:       { color: '#059669', Icon: Phone,        typeLabel: 'Call',       placeholder: 'Phone call' },
  meeting:    { color: '#7C3AED', Icon: CalendarDays, typeLabel: 'Meeting',    placeholder: 'Meeting' },
  automation: { color: '#F43F5E', Icon: Zap,          typeLabel: 'Automation', placeholder: 'Automation' },
  goal:       { color: '#EAB308', Icon: Flag,         typeLabel: 'Goal',       placeholder: 'Goal' },
  // Notifications + integrations
  sms_notification:   { color: '#15803D', Icon: MessageSquare, typeLabel: 'SMS Notification',     placeholder: 'SMS notification' },
  email_notification: { color: '#B91C1C', Icon: Mail,          typeLabel: 'Email Notification',   placeholder: 'Email notification' },
  ghl_notification:   { color: '#0EA5E9', Icon: Bell,          typeLabel: 'HighLevel',            placeholder: 'HighLevel notification' },
  google_sheet:       { color: '#0F9D58', Icon: Sheet,         typeLabel: 'Google Sheet',         placeholder: 'Add to Google Sheet' },
  webhook:            { color: '#7C3AED', Icon: Webhook,       typeLabel: 'Webhook',              placeholder: 'Webhook' },
  // Additional events (Funnelytics parity)
  page_view:          { color: '#0EA5E9', Icon: Eye,           typeLabel: 'Page View',            placeholder: 'Page view' },
  time_on_page:       { color: '#6366F1', Icon: Timer,         typeLabel: 'Time on Page',         placeholder: 'Time on page' },
  exit_intent:        { color: '#F43F5E', Icon: LogOut,        typeLabel: 'Exit Intent',          placeholder: 'Exit intent' },
  refund:             { color: '#DC2626', Icon: Undo2,         typeLabel: 'Refund',               placeholder: 'Refund' },
  download:           { color: '#10B981', Icon: Download,      typeLabel: 'Download',             placeholder: 'Download' },
  share:              { color: '#A855F7', Icon: Share2,        typeLabel: 'Share',                placeholder: 'Share' },
  login:              { color: '#0F766E', Icon: LogIn,         typeLabel: 'Login',                placeholder: 'Login' },
  // Conversion actions
  form_completed:     { color: '#10B981', Icon: ClipboardCheck, typeLabel: 'Form Completed',      placeholder: 'Form completed' },
  schedule_meeting:   { color: '#3B82F6', Icon: CalendarCheck,  typeLabel: 'Schedule Meeting',    placeholder: 'Schedule meeting' },
  deal_won:           { color: '#EAB308', Icon: Trophy,         typeLabel: 'Deal Won',            placeholder: 'Deal won' },
  // GHL integration actions
  ghl_appointment:    { color: '#F97316', Icon: CalendarDays,   typeLabel: 'GHL Appointment',     placeholder: 'GHL appointment' },
  ghl_order:          { color: '#F97316', Icon: ShoppingBag,    typeLabel: 'GHL Order',           placeholder: 'GHL order' },
  ghl_opportunity:    { color: '#F97316', Icon: Target,         typeLabel: 'GHL Opportunity',     placeholder: 'GHL opportunity' },
  ghl_opportunity_won:{ color: '#15803D', Icon: Crown,          typeLabel: 'GHL Opportunity Won', placeholder: 'GHL opportunity won' },
  // Field-service conversion actions
  on_site_visit:      { color: '#6366F1', Icon: MapPin,          typeLabel: 'On-Site Visit',       placeholder: 'On-site visit' },
  send_quote:         { color: '#06B6D4', Icon: Send,            typeLabel: 'Send Quote',          placeholder: 'Send quote' },
  // GHL post-sale actions
  send_google_review:      { color: '#F59E0B', Icon: Star, typeLabel: 'Send Google Review',      placeholder: 'Send Google review' },
  add_to_referral_program: { color: '#EC4899', Icon: Gift, typeLabel: 'Add to Referral Program', placeholder: 'Add to referral program' },
};

export const DIAMOND_TYPES = new Set<string>(Object.keys(DIAMOND_CONFIG));

/* ─── Re-export Clock for WaitDiamond ────────────────────────────── */

export { Clock };
