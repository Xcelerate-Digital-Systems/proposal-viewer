/** All valid icon slugs for funnel step nodes and shapes.
 *  Shared between the renderer (FunnelStepNode) and MCP validation. */

export const LUCIDE_ICON_SLUGS = [
  'megaphone', 'search', 'mail', 'link', 'monitor', 'badge-dollar', 'user-plus',
  'credit-card', 'heart', 'trending-up', 'trending-down', 'video', 'package',
  'graduation-cap', 'briefcase', 'gift', 'square', 'sparkles', 'target', 'globe',
  'smartphone', 'phone', 'message-square', 'calendar', 'zap', 'flag', 'file-text',
  'image', 'music', 'share-2', 'users', 'mic', 'star', 'newspaper', 'book-open',
  'cloud', 'repeat', 'timer', 'layers', 'user-cog', 'ticket', 'external-link',
  'square-user', 'qr-code', 'badge-check', 'check-circle', 'handshake',
  'phone-outgoing', 'rocket', 'send', 'user-x', 'diamond', 'clock', 'calendar-days',
  'mouse-pointer-click', 'play-circle', 'chevrons-down', 'shopping-bag', 'shopping-cart',
  'bell-ring', 'bell', 'sheet', 'eye', 'log-out', 'log-in', 'undo-2', 'download',
  'webhook', 'clipboard-check', 'calendar-check', 'trophy', 'crown', 'map-pin', 'circle-x',
  'chatbot',
] as const;

export const BRAND_ICON_SLUGS = [
  'facebook', 'instagram', 'google', 'youtube', 'tiktok', 'linkedin', 'pinterest',
  'twitter', 'snapchat', 'bing', 'reddit', 'stripe', 'mailchimp',
  'hubspot', 'ghl', 'activecampaign', 'salesforce', 'slack',
  'simpro', 'aroflo', 'workflowmax', 'servicem8', 'fergus', 'ascora', 'jobber',
  'messenger', 'whatsapp',
  'zoho', 'yelp', 'amazon', 'zoom', 'gmail', 'spotify', 'google-maps',
] as const;

export const ALL_ICON_SLUGS = [...LUCIDE_ICON_SLUGS, ...BRAND_ICON_SLUGS];
export const VALID_ICON_SLUGS_SET = new Set<string>(ALL_ICON_SLUGS);
