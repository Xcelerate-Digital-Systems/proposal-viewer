import {
  Diamond, Clock, Flag, Phone, CalendarDays, Zap,
  MousePointerClick, FileText, PlayCircle, ChevronsDown,
  ShoppingBag, ShoppingCart, BellRing, Sparkles,
  MessageSquare, Mail, Bell, Sheet,
  Eye, Timer, LogOut, LogIn, Undo2, Download, Share2, Webhook,
  ClipboardCheck, CalendarCheck, Trophy, Target, Crown, MapPin, Send,
  Star, Gift,
  type LucideIcon,
} from 'lucide-react';

/** Shared action-shape vocabulary used by both the feedback board palette and
 *  the funnel board palette. Strict subset of FeedbackShapeType / FunnelShapeType
 *  — drawing primitives (rectangle/ellipse/arrow/line/text) are intentionally
 *  excluded because they belong to the drawing toolbar, not the action library. */
export type BoardActionShapeId =
  | 'decision' | 'wait' | 'goal'
  | 'call' | 'meeting' | 'automation'
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

export interface BoardActionItem {
  shapeType: BoardActionShapeId;
  label: string;
  iconName: string;
}

export interface BoardActionGroup {
  key: string;
  label: string;
  items: BoardActionItem[];
}

export const BOARD_ACTION_ICONS: Record<string, LucideIcon> = {
  diamond: Diamond, clock: Clock, flag: Flag, phone: Phone,
  'calendar-days': CalendarDays, zap: Zap,
  'mouse-pointer-click': MousePointerClick, 'file-text': FileText,
  'play-circle': PlayCircle, 'chevrons-down': ChevronsDown,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart,
  'bell-ring': BellRing, sparkles: Sparkles, 'message-square': MessageSquare,
  mail: Mail, bell: Bell, sheet: Sheet, eye: Eye, timer: Timer,
  'log-out': LogOut, 'log-in': LogIn, 'undo-2': Undo2,
  download: Download, 'share-2': Share2, webhook: Webhook,
  'clipboard-check': ClipboardCheck, 'calendar-check': CalendarCheck,
  trophy: Trophy, target: Target, crown: Crown,
  'map-pin': MapPin, send: Send,
  star: Star, gift: Gift,
};

/** Tile background tint per action shape. Kept in lockstep with
 *  `DIAMOND_CONFIG` in feedback/board/nodes/ShapeNode.tsx so the palette
 *  tile colour matches the colour the node actually paints on canvas. */
export const BOARD_ACTION_TINTS: Record<BoardActionShapeId, string> = {
  // Conversion
  purchase: '#10B981', add_to_cart: '#F97316', subscribe: '#EC4899', goal: '#EAB308',
  form_completed: '#10B981', schedule_meeting: '#3B82F6', deal_won: '#EAB308',
  on_site_visit: '#6366F1', send_quote: '#06B6D4',
  send_google_review: '#F59E0B', add_to_referral_program: '#EC4899',
  // Engagement
  page_view: '#0EA5E9', button_click: '#3B82F6', form_submit: '#06B6D4',
  video_play: '#EF4444', scroll_depth: '#6366F1', time_on_page: '#6366F1', exit_intent: '#F43F5E',
  // Integration
  sms_notification: '#15803D', email_notification: '#B91C1C', ghl_notification: '#0EA5E9',
  webhook: '#7C3AED', google_sheet: '#0F9D58',
  call: '#059669', meeting: '#7C3AED', automation: '#F43F5E',
  ghl_appointment: '#F97316', ghl_order: '#F97316',
  ghl_opportunity: '#F97316', ghl_opportunity_won: '#15803D',
  // Custom Actions
  decision: '#B45309', wait: '#8B5CF6', refund: '#DC2626',
  download: '#10B981', share: '#A855F7', login: '#0F766E', custom_event: '#64748B',
};

/** Single source of truth for action-shape tiles. Both the feedback board
 *  palette (Actions tab) and the funnel board palette (Actions tab) consume
 *  this — add an item here and it appears in both tools automatically. */
export const BOARD_ACTION_GROUPS: BoardActionGroup[] = [
  {
    key: 'conversion',
    label: 'Conversion Actions',
    items: [
      { shapeType: 'purchase',         label: 'Purchase',         iconName: 'shopping-bag' },
      { shapeType: 'form_completed',   label: 'Form Completed',   iconName: 'clipboard-check' },
      { shapeType: 'schedule_meeting', label: 'Schedule Meeting', iconName: 'calendar-check' },
      { shapeType: 'on_site_visit',    label: 'On-Site Visit',    iconName: 'map-pin' },
      { shapeType: 'send_quote',       label: 'Send Quote',       iconName: 'send' },
      { shapeType: 'deal_won',         label: 'Deal Won',         iconName: 'trophy' },
      { shapeType: 'add_to_cart',      label: 'Add to Cart',      iconName: 'shopping-cart' },
      { shapeType: 'subscribe',        label: 'Subscribe',        iconName: 'bell-ring' },
      { shapeType: 'goal',             label: 'Goal',             iconName: 'flag' },
    ],
  },
  {
    key: 'engagement',
    label: 'Engagement Actions',
    items: [
      { shapeType: 'page_view',    label: 'Page View',    iconName: 'eye' },
      { shapeType: 'button_click', label: 'Button Click', iconName: 'mouse-pointer-click' },
      { shapeType: 'form_submit',  label: 'Form Submit',  iconName: 'file-text' },
      { shapeType: 'video_play',   label: 'Video Play',   iconName: 'play-circle' },
      { shapeType: 'scroll_depth', label: 'Scroll Depth', iconName: 'chevrons-down' },
      { shapeType: 'time_on_page', label: 'Time on Page', iconName: 'timer' },
      { shapeType: 'exit_intent',  label: 'Exit Intent',  iconName: 'log-out' },
    ],
  },
  {
    key: 'integration',
    label: 'Integration Actions',
    items: [
      { shapeType: 'webhook',     label: 'Webhook',      iconName: 'webhook' },
      { shapeType: 'google_sheet',label: 'Google Sheet', iconName: 'sheet' },
      { shapeType: 'call',        label: 'Call',         iconName: 'phone' },
      { shapeType: 'meeting',     label: 'Meeting',      iconName: 'calendar-days' },
      { shapeType: 'automation',  label: 'Automation',   iconName: 'zap' },
    ],
  },
  {
    key: 'gohighlevel',
    label: 'GoHighLevel Actions',
    items: [
      { shapeType: 'sms_notification',       label: 'SMS Notification',        iconName: 'message-square' },
      { shapeType: 'email_notification',     label: 'Email Notification',      iconName: 'mail' },
      { shapeType: 'ghl_notification',       label: 'HighLevel',               iconName: 'bell' },
      { shapeType: 'ghl_appointment',        label: 'GHL Appointment',         iconName: 'calendar-days' },
      { shapeType: 'ghl_order',              label: 'GHL Order',               iconName: 'shopping-bag' },
      { shapeType: 'ghl_opportunity',        label: 'GHL Opportunity',         iconName: 'target' },
      { shapeType: 'ghl_opportunity_won',    label: 'GHL Opportunity Won',     iconName: 'crown' },
      { shapeType: 'send_google_review',     label: 'Send Google Review',      iconName: 'star' },
      { shapeType: 'add_to_referral_program',label: 'Add to Referral Program', iconName: 'gift' },
    ],
  },
  {
    key: 'custom_actions',
    label: 'Custom Actions',
    items: [
      { shapeType: 'decision',     label: 'Decision',     iconName: 'diamond' },
      { shapeType: 'wait',         label: 'Wait',         iconName: 'clock' },
      { shapeType: 'refund',       label: 'Refund',       iconName: 'undo-2' },
      { shapeType: 'download',     label: 'Download',     iconName: 'download' },
      { shapeType: 'share',        label: 'Share',        iconName: 'share-2' },
      { shapeType: 'login',        label: 'Login',        iconName: 'log-in' },
      { shapeType: 'custom_event', label: 'Custom Event', iconName: 'sparkles' },
    ],
  },
];
