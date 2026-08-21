import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';
import { FUNNEL_STEP_DEFAULTS, defaultRoleColor } from '@/lib/types/funnel';
import { BOARD_ACTION_GROUPS } from '@/lib/types/board-actions';
import { LUCIDE_ICON_SLUGS, BRAND_ICON_SLUGS, VALID_ICON_SLUGS_SET } from '@/lib/funnel/icon-slugs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function friendlyError(msg: string): string {
  if (msg.includes('invalid input syntax for type uuid'))
    return 'Invalid UUID format — check that all IDs are valid UUIDs.';
  if (msg.includes('foreign key constraint')) {
    if (msg.includes('source_step_id')) return 'Source step not found — check the sourceStepId is valid.';
    if (msg.includes('target_step_id')) return 'Target step not found — check the targetStepId is valid.';
    if (msg.includes('source_shape_id')) return 'Source shape not found — check the sourceShapeId is valid.';
    if (msg.includes('target_shape_id')) return 'Target shape not found — check the targetShapeId is valid.';
    return 'One of the referenced IDs was not found — check all IDs are valid.';
  }
  return msg;
}

const NODE_TYPE_CATALOG = buildNodeTypeCatalog();

function buildNodeTypeCatalog() {
  const sources: Record<string, { slug: string; label: string; icon: string }[]> = {
    paid: [], search: [], social: [], other: [], crm: [], messaging: [], other_sites: [], offline: [],
  };
  const pages: { slug: string; label: string; icon: string }[] = [];
  const offers: { slug: string; label: string; icon: string }[] = [];
  const stages: { slug: string; label: string; icon: string }[] = [];

  for (const [slug, d] of Object.entries(FUNNEL_STEP_DEFAULTS)) {
    const entry = { slug, label: d.label, icon: d.icon };
    if (slug.startsWith('traffic_')) {
      if (slug.endsWith('_ads') || slug === 'traffic_paid' || slug === 'traffic_native_ads') sources.paid.push(entry);
      else if (['traffic_organic', 'traffic_google_organic', 'traffic_bing_organic', 'traffic_youtube_organic'].includes(slug)) sources.search.push(entry);
      else if (['traffic_facebook_organic', 'traffic_instagram_organic', 'traffic_linkedin_organic', 'traffic_tiktok_organic', 'traffic_twitter_organic', 'traffic_pinterest_organic', 'traffic_reddit_organic', 'traffic_organic_social'].includes(slug)) sources.social.push(entry);
      else if (['traffic_direct', 'traffic_referral', 'traffic_affiliate'].includes(slug)) sources.other.push(entry);
      else if (['traffic_hubspot', 'traffic_ghl', 'traffic_activecampaign', 'traffic_salesforce', 'traffic_simpro', 'traffic_aroflo', 'traffic_workflowmax', 'traffic_servicem8', 'traffic_fergus', 'traffic_ascora', 'traffic_jobber'].includes(slug)) sources.crm.push(entry);
      else if (['traffic_slack', 'traffic_messenger', 'traffic_whatsapp', 'traffic_chatbot'].includes(slug)) sources.messaging.push(entry);
      else if (['traffic_zoho', 'traffic_yelp', 'traffic_amazon', 'traffic_zoom', 'traffic_gmail', 'traffic_spotify', 'traffic_snapchat_organic', 'traffic_google_maps'].includes(slug)) sources.other_sites.push(entry);
      else if (['traffic_print_ad', 'traffic_conference', 'traffic_direct_mail', 'traffic_meeting', 'traffic_billboard', 'traffic_business_card', 'traffic_phone', 'traffic_report', 'traffic_qr_code', 'traffic_offline', 'traffic_podcast', 'traffic_influencer'].includes(slug)) sources.offline.push(entry);
      else if (['traffic_email', 'traffic_sms'].includes(slug)) sources.messaging.push(entry);
    } else if (slug.startsWith('page_')) pages.push(entry);
    else if (slug.startsWith('offer_')) offers.push(entry);
    else if (slug.startsWith('stage_')) stages.push(entry);
  }

  const actions: Record<string, { slug: string; label: string; icon: string }[]> = {};
  for (const g of BOARD_ACTION_GROUPS) {
    actions[g.key] = g.items.map(i => ({ slug: i.shapeType, label: i.label, icon: i.iconName }));
  }

  const drawing = [
    { slug: 'rectangle', label: 'Rectangle', icon: 'square' },
    { slug: 'ellipse', label: 'Ellipse', icon: 'circle' },
    { slug: 'arrow', label: 'Arrow', icon: 'move-right' },
    { slug: 'double_arrow', label: 'Double Arrow', icon: 'move-horizontal' },
    { slug: 'elbow_arrow', label: 'Elbow Arrow', icon: 'corner-down-right' },
    { slug: 'line', label: 'Line', icon: 'minus' },
    { slug: 'text', label: 'Text', icon: 'type' },
  ];

  return { sources, pages, offers, stages, actions, drawing };
}

/** Resolve auth for a child operation (step/edge/shape) on a known funnel.
 *  When companyId is omitted, looks up the funnel's company_id so the caller
 *  doesn't have to repeat it on every child call. */
async function resolveAuthForFunnel(
  extra: { authInfo?: import('@modelcontextprotocol/sdk/server/auth/types.js').AuthInfo },
  funnelId: string,
  companyId?: string,
) {
  if (companyId) {
    const auth = getAuth(extra, companyId);
    return auth ? { auth, funnelId } : null;
  }
  const auth = getAuth(extra);
  if (!auth) return null;
  const sb = createServiceClient();
  const { data: funnel } = await sb.from('funnels')
    .select('id, company_id')
    .eq('id', funnelId)
    .single();
  if (!funnel) return null;
  if (funnel.company_id === auth.companyId) return { auth, funnelId };
  if (!auth.isSuperAdmin) return null;
  return { auth: { ...auth, companyId: funnel.company_id }, funnelId };
}

export function registerFunnelTools(server: McpServer) {

  server.tool('list_funnel_node_types', 'List all valid funnel node types grouped by category (Sources, Pages, Offers, Actions, Drawing). Steps use stepType slugs; Actions and Drawing use shapeType slugs via create_funnel_shape.', {
    category: z.enum(['all', 'sources', 'pages', 'offers', 'stages', 'actions', 'drawing']).optional().describe('Filter to a specific category. Default: all'),
  }, async ({ category }) => {
    const cat = category || 'all';
    const result: Record<string, unknown> = {};
    if (cat === 'all' || cat === 'sources') result.sources = { note: 'Use with create_funnel_step (stepType)', groups: NODE_TYPE_CATALOG.sources };
    if (cat === 'all' || cat === 'pages') result.pages = { note: 'Use with create_funnel_step (stepType)', items: NODE_TYPE_CATALOG.pages };
    if (cat === 'all' || cat === 'offers') result.offers = { note: 'Use with create_funnel_step (stepType)', items: NODE_TYPE_CATALOG.offers };
    if (cat === 'all' || cat === 'stages') result.stages = { note: 'Use with create_funnel_step (stepType) — pipeline/CRM holding states', items: NODE_TYPE_CATALOG.stages };
    if (cat === 'all' || cat === 'actions') result.actions = { note: 'Use with create_funnel_shape (shapeType)', groups: NODE_TYPE_CATALOG.actions };
    if (cat === 'all' || cat === 'drawing') result.drawing = { note: 'Use with create_funnel_shape (shapeType)', items: NODE_TYPE_CATALOG.drawing };
    if (cat === 'all') {
      result._summary = {
        stepTypes: 'traffic_*, page_*, offer_*, stage_*, generic → use create_funnel_step',
        shapeTypes: 'action nodes + drawing primitives → use create_funnel_shape',
      };
    }
    return json(result);
  });

  server.tool('list_funnel_icons', 'List all valid icon slugs that can be used with create_funnel_step, update_funnel_step, create_funnel_shape, and update_funnel_shape. Icons not in this list will be rejected.', {
    group: z.enum(['all', 'lucide', 'brands']).optional().describe('Filter to Lucide icons or brand logos. Default: all'),
  }, async ({ group }) => {
    const g = group || 'all';
    const result: Record<string, unknown> = {};
    if (g === 'all' || g === 'lucide') result.lucide = { note: 'Generic icons from the Lucide icon set', slugs: [...LUCIDE_ICON_SLUGS] };
    if (g === 'all' || g === 'brands') result.brands = { note: 'Brand/platform logos (rendered as SVGs)', slugs: [...BRAND_ICON_SLUGS] };
    result.total = VALID_ICON_SLUGS_SET.size;
    return json(result);
  });

  server.tool('list_funnels', 'List all funnels in the workspace.', {
    status: z.enum(['draft', 'active', 'archived', 'all']).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ status, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    let q = sb.from('funnels')
      .select('id, name, description, status, currency, forecast_period, is_template, created_at, updated_at')
      .eq('company_id', auth.companyId).eq('is_template', false).order('updated_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No funnels found.');
    return json(data);
  });

  server.tool('get_funnel', 'Get funnel detail with all steps, edges, and shapes. Pass tabId to filter to a single tab (recommended for large boards).', {
    funnelId: z.string(),
    tabId: z.string().optional().describe('Filter to a single tab — drastically reduces payload on multi-tab boards'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel. Super admin: override to target a different company'),
  }, async ({ funnelId, tabId, companyId }, extra) => {
    const resolved = await resolveAuthForFunnel(extra, funnelId, companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: funnel } = await sb.from('funnels').select('*').eq('id', funnelId).eq('company_id', auth.companyId).single();
    if (!funnel) return txt('Funnel not found');
    let stepsQ = sb.from('funnel_steps').select('id, step_type, label, icon, url, color, board_x, board_y, metrics, linked_funnel_id, linked_tab_id, description, message, role_id, platform, tab_id, created_at').eq('funnel_id', funnelId).eq('company_id', auth.companyId);
    let edgesQ = sb.from('funnel_board_edges').select('id, source_step_id, source_shape_id, target_step_id, target_shape_id, source_handle, target_handle, label, edge_type, animated, split_percent, style, tab_id').eq('funnel_id', funnelId).eq('company_id', auth.companyId);
    let shapesQ = sb.from('funnel_board_shapes').select('id, shape_type, x, y, width, height, end_x, end_y, content, color, stroke_width, dashed, font_size, linked_funnel_id, linked_tab_id, description, message, role_id, platform, tab_id').eq('funnel_id', funnelId).eq('company_id', auth.companyId);
    let sectionsQ = sb.from('funnel_board_sections').select('id, label, color, x, y, width, height, tab_id, locked').eq('funnel_id', funnelId).eq('company_id', auth.companyId);
    if (tabId) {
      stepsQ = stepsQ.eq('tab_id', tabId);
      edgesQ = edgesQ.eq('tab_id', tabId);
      shapesQ = shapesQ.eq('tab_id', tabId);
      sectionsQ = sectionsQ.eq('tab_id', tabId);
    }
    const [{ data: steps }, { data: edges }, { data: shapes }, { data: sections }] = await Promise.all([stepsQ, edgesQ, shapesQ, sectionsQ]);
    return json({
      id: funnel.id, name: funnel.name, description: funnel.description, status: funnel.status,
      currency: funnel.currency, forecastPeriod: funnel.forecast_period, defaultDealValue: funnel.default_deal_value,
      isTemplate: funnel.is_template,
      createdAt: funnel.created_at, updatedAt: funnel.updated_at,
      ...(tabId ? { filteredByTabId: tabId } : {}),
      _nodeSizeHint: 'Steps are fixed-size circles — the rendered frame is roughly 140×140px, plus a description card below (140×variable). Shapes have explicit width/height when set. Use these approximations for collision/layout calculations.',
      steps: (steps || []).map(s => ({
        id: s.id, type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
        position: { x: s.board_x, y: s.board_y }, metrics: s.metrics,
        linkedFunnelId: s.linked_funnel_id, linkedTabId: s.linked_tab_id,
        tabId: s.tab_id, description: s.description, message: s.message,
        roleId: s.role_id, platform: s.platform,
      })),
      edges: (edges || []).map(e => ({
        id: e.id, sourceStepId: e.source_step_id, sourceShapeId: e.source_shape_id,
        targetStepId: e.target_step_id, targetShapeId: e.target_shape_id,
        sourceHandle: e.source_handle, targetHandle: e.target_handle,
        label: e.label, edgeType: e.edge_type, animated: e.animated,
        splitPercent: e.split_percent, style: e.style, tabId: e.tab_id,
      })),
      shapes: (shapes || []).map(s => ({
        id: s.id, type: s.shape_type, x: s.x, y: s.y, width: s.width, height: s.height,
        endX: s.end_x, endY: s.end_y,
        content: s.content, color: s.color, strokeWidth: s.stroke_width,
        dashed: s.dashed, fontSize: s.font_size,
        linkedFunnelId: s.linked_funnel_id, linkedTabId: s.linked_tab_id,
        tabId: s.tab_id, description: s.description, message: s.message,
        roleId: s.role_id, platform: s.platform,
      })),
      sections: (sections || []).map(sec => ({
        id: sec.id, label: sec.label, color: sec.color,
        x: sec.x, y: sec.y, width: sec.width, height: sec.height,
        tabId: sec.tab_id, locked: sec.locked,
      })),
    });
  });

  server.tool('create_funnel', 'Create a new empty funnel. Returns the funnel ID and share token.', {
    name: z.string(),
    description: z.string().optional(),
    currency: z.enum(['USD', 'AUD', 'GBP', 'EUR', 'CAD', 'NZD']).optional().describe('Default: USD'),
    forecastPeriod: z.enum(['total', 'monthly', 'yearly']).optional(),
    defaultDealValue: z.number().optional().describe('Default revenue per conversion'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const row: Record<string, unknown> = {
      company_id: auth.companyId,
      name: args.name,
      description: args.description || null,
      created_by: auth.userId,
    };
    if (args.currency) row.currency = args.currency;
    if (args.forecastPeriod) row.forecast_period = args.forecastPeriod;
    if (args.defaultDealValue !== undefined) row.default_deal_value = args.defaultDealValue;
    const { data, error } = await sb.from('funnels').insert(row).select('id').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json({ id: data.id });
  });

  server.tool('update_funnel', 'Update funnel name, description, status, currency, or forecast settings.', {
    funnelId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    currency: z.enum(['USD', 'AUD', 'GBP', 'EUR', 'CAD', 'NZD']).optional(),
    forecastPeriod: z.enum(['total', 'monthly', 'yearly']).optional(),
    defaultDealValue: z.number().optional(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel. Super admin: override to target a different company'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: f } = await sb.from('funnels').select('id').eq('id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Funnel not found');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const MAP: [string, string][] = [
      ['name', 'name'], ['description', 'description'], ['status', 'status'],
      ['currency', 'currency'], ['forecastPeriod', 'forecast_period'],
      ['defaultDealValue', 'default_deal_value'],
    ];
    let count = 0;
    for (const [param, col] of MAP) {
      const val = (args as Record<string, unknown>)[param];
      if (val !== undefined) { updates[col] = val; count++; }
    }
    if (count === 0) return txt('No fields to update.');
    const { error } = await sb.from('funnels').update(updates).eq('id', args.funnelId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt(`Funnel updated (${count} field${count > 1 ? 's' : ''}).`);
  });

  server.tool('delete_funnel', 'Delete a funnel and all its steps, edges, notes, and shapes.', {
    funnelId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ funnelId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('funnels').select('id, name').eq('id', funnelId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Funnel not found');
    const { error } = await sb.from('funnels').delete().eq('id', funnelId).eq('company_id', auth.companyId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt(`Funnel "${f.name}" deleted.`);
  });

  server.tool('create_funnel_step', 'Add a step (node) to a funnel. Use list_funnel_node_types to see valid stepType values. Returns the new step ID.', {
    funnelId: z.string(),
    stepType: z.string().describe('Step type slug — call list_funnel_node_types to see all valid values'),
    label: z.string().describe('Display label for the node'),
    x: z.number().describe('Canvas X coordinate'),
    y: z.number().describe('Canvas Y coordinate'),
    icon: z.string().optional().describe('Icon slug — call list_funnel_icons to see all valid values'),
    url: z.string().optional().describe('Reference URL (e.g. the live page URL)'),
    color: z.string().optional().describe('Hex color for the node'),
    metrics: z.object({
      visitors: z.number().optional().describe('Incoming visitors (traffic sources)'),
      conversion_rate: z.number().optional().describe('0-100 conversion rate'),
      cost: z.number().optional().describe('Cost per visitor or per conversion'),
      value: z.number().optional().describe('Revenue per conversion'),
      recurring_months: z.number().optional().describe('Months of recurring revenue per conversion'),
      notes: z.string().optional(),
    }).optional().describe('Forecast metrics'),
    linkedFunnelId: z.string().optional().describe('Link this step to another funnel — clicking it navigates to that funnel'),
    linkedTabId: z.string().optional().describe('Link this step to a tab within the same funnel — clicking it switches to that tab'),
    tabId: z.string().optional().describe('Tab this step belongs to (required when funnel has tabs)'),
    description: z.string().optional().describe('Description text shown below the step label'),
    message: z.object({
      kind: z.enum(['email', 'sms']),
      from: z.string().optional().describe('Email only — the sender line'),
      subject: z.string().optional().describe('Email only'),
      preheader: z.string().optional().describe('Email only — inbox preview text'),
      body: z.string(),
    }).nullable().optional().describe('Email/SMS copy attached to this node, shown in a preview modal on click. Only meaningful on message-capable types (traffic_email, traffic_sms, email_notification, sms_notification).'),
    roleId: z.string().nullable().optional().describe('Owning role — a plain label, not a user account. Use list_funnel_roles / create_funnel_role.'),
    platform: z.string().nullable().optional().describe('System this node runs in — a brand slug ("ghl", "servicem8", "hubspot") or the public URL of an uploaded logo. Rendered as a badge on the node.'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel. Super admin: override to target a different company'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    if (args.icon && !VALID_ICON_SLUGS_SET.has(args.icon)) {
      return txt(`Invalid icon "${args.icon}". Call list_funnel_icons to see all valid icon slugs.`);
    }
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_steps').insert({
      funnel_id: args.funnelId,
      company_id: auth.companyId,
      step_type: args.stepType,
      label: args.label,
      icon: args.icon || null,
      url: args.url || null,
      color: args.color || null,
      board_x: Math.round(args.x),
      board_y: Math.round(args.y),
      metrics: args.metrics || {},
      linked_funnel_id: args.linkedFunnelId || null,
      linked_tab_id: args.linkedTabId || null,
      tab_id: args.tabId || null,
      description: args.description || null,
      message: args.message ?? null,
      role_id: args.roleId ?? null,
      platform: args.platform ?? null,
    }).select('id, step_type, label, board_x, board_y').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json({ id: data.id, type: data.step_type, label: data.label, position: { x: data.board_x, y: data.board_y } });
  });

  server.tool('update_funnel_step', 'Update a step node (label, position, metrics, icon, color, URL, stepType, tabId). No need to delete and recreate to change type or move between tabs.', {
    stepId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
    stepType: z.string().optional().describe('Change the step type — call list_funnel_node_types for valid values'),
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    icon: z.string().optional().describe('Icon slug — call list_funnel_icons for valid values'),
    url: z.string().optional(),
    color: z.string().optional(),
    metrics: z.object({
      visitors: z.number().optional(),
      conversion_rate: z.number().optional(),
      cost: z.number().optional(),
      value: z.number().optional(),
      recurring_months: z.number().optional(),
      notes: z.string().optional(),
    }).optional(),
    linkedFunnelId: z.string().nullable().optional().describe('Link to another funnel (pass null to clear)'),
    linkedTabId: z.string().nullable().optional().describe('Link to a tab within the same funnel (pass null to clear)'),
    tabId: z.string().nullable().optional().describe('Move this step to a different tab'),
    description: z.string().nullable().optional().describe('Description text shown below the step label (pass null to clear)'),
    message: z.object({
      kind: z.enum(['email', 'sms']),
      from: z.string().optional().describe('Email only — the sender line'),
      subject: z.string().optional().describe('Email only'),
      preheader: z.string().optional().describe('Email only — inbox preview text'),
      body: z.string(),
    }).nullable().optional().describe('Email/SMS copy attached to this node, shown in a preview modal on click. Only meaningful on message-capable types (traffic_email, traffic_sms, email_notification, sms_notification).'),
    roleId: z.string().nullable().optional().describe('Owning role — a plain label, not a user account. Use list_funnel_roles / create_funnel_role.'),
    platform: z.string().nullable().optional().describe('System this node runs in — a brand slug ("ghl", "servicem8", "hubspot") or the public URL of an uploaded logo. Rendered as a badge on the node.'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    if (args.icon && !VALID_ICON_SLUGS_SET.has(args.icon)) {
      return txt(`Invalid icon "${args.icon}". Call list_funnel_icons to see all valid icon slugs.`);
    }
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: step } = await sb.from('funnel_steps').select('id').eq('id', args.stepId).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!step) return txt('Step not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.stepType !== undefined) patch.step_type = args.stepType;
    if (args.label !== undefined) patch.label = args.label;
    if (args.x !== undefined) patch.board_x = Math.round(args.x);
    if (args.y !== undefined) patch.board_y = Math.round(args.y);
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.url !== undefined) patch.url = args.url;
    if (args.color !== undefined) patch.color = args.color;
    if (args.metrics !== undefined) patch.metrics = args.metrics;
    if (args.linkedFunnelId !== undefined) patch.linked_funnel_id = args.linkedFunnelId;
    if (args.linkedTabId !== undefined) patch.linked_tab_id = args.linkedTabId;
    if (args.tabId !== undefined) patch.tab_id = args.tabId;
    if (args.description !== undefined) patch.description = args.description;
    if (args.message !== undefined) patch.message = args.message;
    if (args.roleId !== undefined) patch.role_id = args.roleId;
    if (args.platform !== undefined) patch.platform = args.platform;
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_steps').update(patch).eq('id', args.stepId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Step updated.');
  });

  server.tool('delete_funnel_step', 'Delete a step node and its connected edges.', {
    stepId: z.string(),
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async ({ stepId, funnelId, companyId }, extra) => {
    const resolved = await resolveAuthForFunnel(extra, funnelId, companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: step } = await sb.from('funnel_steps').select('id, label').eq('id', stepId).eq('funnel_id', funnelId).eq('company_id', auth.companyId).single();
    if (!step) return txt('Step not found');
    await sb.from('funnel_board_edges').delete().eq('funnel_id', funnelId).or(`source_step_id.eq.${stepId},target_step_id.eq.${stepId}`);
    const { error } = await sb.from('funnel_steps').delete().eq('id', stepId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt(`Step "${step.label}" deleted (incident edges removed).`);
  });

  server.tool('create_funnel_edge', 'Connect two nodes in a funnel with a labeled edge. Source/target can be a step or a shape.', {
    funnelId: z.string(),
    sourceStepId: z.string().optional().describe('Source step ID (use this OR sourceShapeId)'),
    sourceShapeId: z.string().optional().describe('Source shape ID (use this OR sourceStepId)'),
    targetStepId: z.string().optional().describe('Target step ID (use this OR targetShapeId)'),
    targetShapeId: z.string().optional().describe('Target shape ID (use this OR targetStepId)'),
    sourceHandle: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Default: right'),
    targetHandle: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Default: left'),
    label: z.string().optional().describe('Edge label text'),
    animated: z.boolean().optional(),
    splitPercent: z.number().optional().describe('0-100 flow split percentage'),
    edgeType: z.string().optional().describe('Edge type. Default: labeled'),
    tabId: z.string().optional().describe('Tab this edge belongs to (required when funnel has tabs)'),
    style: z.object({
      stroke: z.string().optional().describe('Stroke colour, e.g. "#2B2B2B"'),
      strokeWidth: z.number().optional().describe('Stroke width in px'),
      dashed: z.boolean().optional().describe('Dashed line style'),
    }).optional().describe('Visual style overrides'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    if (!args.sourceStepId && !args.sourceShapeId) return txt('Provide either sourceStepId or sourceShapeId.');
    if (!args.targetStepId && !args.targetShapeId) return txt('Provide either targetStepId or targetShapeId.');
    const sb = createServiceClient();
    const edgeStyle: Record<string, unknown> = { stroke: '#2B2B2B', strokeWidth: 2 };
    if (args.style) {
      if (args.style.stroke) edgeStyle.stroke = args.style.stroke;
      if (args.style.strokeWidth) edgeStyle.strokeWidth = args.style.strokeWidth;
      if (args.style.dashed) edgeStyle.dashed = args.style.dashed;
    }
    const { data, error } = await sb.from('funnel_board_edges').insert({
      funnel_id: args.funnelId,
      company_id: auth.companyId,
      source_step_id: args.sourceStepId || null,
      source_shape_id: args.sourceShapeId || null,
      target_step_id: args.targetStepId || null,
      target_shape_id: args.targetShapeId || null,
      source_handle: args.sourceHandle || 'right',
      target_handle: args.targetHandle || 'left',
      label: args.label || null,
      edge_type: args.edgeType || 'labeled',
      animated: args.animated ?? false,
      split_percent: args.splitPercent ?? null,
      tab_id: args.tabId || null,
      style: edgeStyle,
    }).select('id').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json({ id: data.id, label: args.label || null });
  });

  server.tool('update_funnel_edge', 'Update an edge (label, handles, animation, split percent, styling, tab).', {
    edgeId: z.string(),
    funnelId: z.string(),
    label: z.string().nullable().optional(),
    sourceHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
    targetHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
    animated: z.boolean().optional(),
    splitPercent: z.number().nullable().optional(),
    edgeType: z.string().optional(),
    tabId: z.string().nullable().optional().describe('Move this edge to a different tab'),
    style: z.object({
      stroke: z.string().optional().describe('Stroke colour, e.g. "#2B2B2B"'),
      strokeWidth: z.number().optional().describe('Stroke width in px'),
      dashed: z.boolean().optional().describe('Dashed line style'),
    }).nullable().optional().describe('Visual style overrides. Pass null to reset to defaults.'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: e } = await sb.from('funnel_board_edges').select('id, style').eq('id', args.edgeId).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!e) return txt('Edge not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.label !== undefined) patch.label = args.label;
    if (args.sourceHandle !== undefined) patch.source_handle = args.sourceHandle;
    if (args.targetHandle !== undefined) patch.target_handle = args.targetHandle;
    if (args.animated !== undefined) patch.animated = args.animated;
    if (args.splitPercent !== undefined) patch.split_percent = args.splitPercent;
    if (args.edgeType !== undefined) patch.edge_type = args.edgeType;
    if (args.tabId !== undefined) patch.tab_id = args.tabId;
    if (args.style !== undefined) {
      if (args.style === null) {
        patch.style = { stroke: '#2B2B2B', strokeWidth: 2 };
      } else {
        const prev = (e.style as Record<string, unknown>) || {};
        const merged = { ...prev };
        if (args.style.stroke !== undefined) merged.stroke = args.style.stroke;
        if (args.style.strokeWidth !== undefined) merged.strokeWidth = args.style.strokeWidth;
        if (args.style.dashed !== undefined) merged.dashed = args.style.dashed;
        patch.style = merged;
      }
    }
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_board_edges').update(patch).eq('id', args.edgeId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Edge updated.');
  });

  // ── Shape (annotation/sticky-note) tools ──

  server.tool('create_funnel_shape', 'Add a shape (sticky note, annotation, decision diamond, action node, etc.) to a funnel board. Returns the new shape ID.', {
    funnelId: z.string(),
    shapeType: z.string().describe('Shape type — primitives: rectangle, ellipse, arrow, double_arrow, elbow_arrow, line, text. Actions: decision, wait, call, meeting, automation, goal, button_click, form_submit, video_play, scroll_depth, purchase, add_to_cart, subscribe, custom_event, page_view, time_on_page, exit_intent, refund, download, share, login, sms_notification, email_notification, ghl_notification, google_sheet, webhook, form_completed, schedule_meeting, deal_won, send_quote, send_google_review, add_to_referral_program, etc.'),
    x: z.number().describe('Canvas X coordinate'),
    y: z.number().describe('Canvas Y coordinate'),
    content: z.string().optional().describe('Text content (for text shapes, sticky notes, labels)'),
    width: z.number().optional().describe('Width in pixels'),
    height: z.number().optional().describe('Height in pixels'),
    color: z.string().optional().describe('Hex color (default: #2B2B2B)'),
    strokeWidth: z.number().optional().describe('Stroke width (default: 2)'),
    dashed: z.boolean().optional().describe('Dashed stroke (default: false)'),
    fontSize: z.number().optional().describe('Font size for text shapes (default: 16 if omitted — large values like 40+ will overflow most containers)'),
    endX: z.number().optional().describe('End X for arrow/line shapes'),
    endY: z.number().optional().describe('End Y for arrow/line shapes'),
    linkedFunnelId: z.string().optional().describe('Link this shape to another funnel — clicking it navigates to that funnel'),
    linkedTabId: z.string().optional().describe('Link this shape to a tab within the same funnel — clicking it switches to that tab'),
    tabId: z.string().optional().describe('Tab this shape belongs to (required when funnel has tabs)'),
    description: z.string().optional().describe('Description text shown below the shape'),
    message: z.object({
      kind: z.enum(['email', 'sms']),
      from: z.string().optional(),
      subject: z.string().optional(),
      preheader: z.string().optional(),
      body: z.string(),
    }).nullable().optional().describe('Email/SMS copy shown in a preview modal on click. Meaningful on email_notification / sms_notification shapes.'),
    roleId: z.string().nullable().optional().describe('Owning role — a plain label, not a user account.'),
    platform: z.string().nullable().optional().describe('System this node runs in — a brand slug ("ghl", "servicem8") or an uploaded logo URL.'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_board_shapes').insert({
      funnel_id: args.funnelId,
      company_id: auth.companyId,
      shape_type: args.shapeType,
      x: Math.round(args.x),
      y: Math.round(args.y),
      width: args.width ?? null,
      height: args.height ?? null,
      end_x: args.endX ?? null,
      end_y: args.endY ?? null,
      content: args.content || null,
      color: args.color || '#2B2B2B',
      stroke_width: args.strokeWidth ?? 2,
      dashed: args.dashed ?? false,
      font_size: args.fontSize ?? null,
      linked_funnel_id: args.linkedFunnelId || null,
      linked_tab_id: args.linkedTabId || null,
      tab_id: args.tabId || null,
      description: args.description || null,
      message: args.message ?? null,
      role_id: args.roleId ?? null,
      platform: args.platform ?? null,
    }).select('id, shape_type, x, y').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json({ id: data.id, type: data.shape_type, position: { x: data.x, y: data.y } });
  });

  server.tool('update_funnel_shape', 'Update a shape (position, size, content, color, stroke, message, role, platform, tab).', {
    shapeId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
    shapeType: z.string().optional().describe('Change shape type'),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    content: z.string().optional(),
    color: z.string().optional(),
    strokeWidth: z.number().optional(),
    dashed: z.boolean().optional(),
    fontSize: z.number().optional(),
    endX: z.number().optional(),
    endY: z.number().optional(),
    linkedFunnelId: z.string().nullable().optional().describe('Link to another funnel (pass null to clear)'),
    linkedTabId: z.string().nullable().optional().describe('Link to a tab within the same funnel (pass null to clear)'),
    tabId: z.string().nullable().optional().describe('Move this shape to a different tab'),
    description: z.string().nullable().optional().describe('Description text shown below the shape (pass null to clear)'),
    message: z.object({
      kind: z.enum(['email', 'sms']),
      from: z.string().optional(),
      subject: z.string().optional(),
      preheader: z.string().optional(),
      body: z.string(),
    }).nullable().optional().describe('Email/SMS copy shown in a preview modal on click (pass null to clear).'),
    roleId: z.string().nullable().optional().describe('Owning role (pass null to clear).'),
    platform: z.string().nullable().optional().describe('System this node runs in — brand slug or uploaded logo URL (pass null to clear).'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: shape } = await sb.from('funnel_board_shapes').select('id').eq('id', args.shapeId).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!shape) return txt('Shape not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.shapeType !== undefined) patch.shape_type = args.shapeType;
    if (args.x !== undefined) patch.x = Math.round(args.x);
    if (args.y !== undefined) patch.y = Math.round(args.y);
    if (args.width !== undefined) patch.width = args.width;
    if (args.height !== undefined) patch.height = args.height;
    if (args.content !== undefined) patch.content = args.content;
    if (args.color !== undefined) patch.color = args.color;
    if (args.strokeWidth !== undefined) patch.stroke_width = args.strokeWidth;
    if (args.dashed !== undefined) patch.dashed = args.dashed;
    if (args.fontSize !== undefined) patch.font_size = args.fontSize;
    if (args.endX !== undefined) patch.end_x = args.endX;
    if (args.endY !== undefined) patch.end_y = args.endY;
    if (args.linkedFunnelId !== undefined) patch.linked_funnel_id = args.linkedFunnelId;
    if (args.linkedTabId !== undefined) patch.linked_tab_id = args.linkedTabId;
    if (args.tabId !== undefined) patch.tab_id = args.tabId;
    if (args.description !== undefined) patch.description = args.description;
    if (args.message !== undefined) patch.message = args.message;
    if (args.roleId !== undefined) patch.role_id = args.roleId;
    if (args.platform !== undefined) patch.platform = args.platform;
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_board_shapes').update(patch).eq('id', args.shapeId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Shape updated.');
  });

  server.tool('delete_funnel_shape', 'Delete a shape and its connected edges from a funnel.', {
    shapeId: z.string(),
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async ({ shapeId, funnelId, companyId }, extra) => {
    const resolved = await resolveAuthForFunnel(extra, funnelId, companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: shape } = await sb.from('funnel_board_shapes').select('id, content').eq('id', shapeId).eq('funnel_id', funnelId).eq('company_id', auth.companyId).single();
    if (!shape) return txt('Shape not found');
    await sb.from('funnel_board_edges').delete().eq('funnel_id', funnelId).or(`source_shape_id.eq.${shapeId},target_shape_id.eq.${shapeId}`);
    const { error } = await sb.from('funnel_board_shapes').delete().eq('id', shapeId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt(`Shape deleted (incident edges removed).`);
  });

  server.tool('delete_funnel_edge', 'Delete an edge (connection) from a funnel.', {
    edgeId: z.string(),
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async ({ edgeId, funnelId, companyId }, extra) => {
    const resolved = await resolveAuthForFunnel(extra, funnelId, companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: e } = await sb.from('funnel_board_edges').select('id').eq('id', edgeId).eq('funnel_id', funnelId).eq('company_id', auth.companyId).single();
    if (!e) return txt('Edge not found');
    const { error } = await sb.from('funnel_board_edges').delete().eq('id', edgeId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Edge deleted.');
  });

  // ── Bulk position update ──

  server.tool('bulk_update_funnel_nodes', 'Move multiple steps and/or shapes in one call. Useful for re-laying out a board without dozens of individual update calls. Steps are fixed-size (no width/height); width/height only applies to shapes.', {
    funnelId: z.string(),
    updates: z.array(z.object({
      id: z.string().describe('Step or shape UUID'),
      kind: z.enum(['step', 'shape']).describe('Whether this ID is a step or a shape'),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional().describe('Shapes only — ignored for steps'),
      height: z.number().optional().describe('Shapes only — ignored for steps'),
    })).describe('Array of position/size updates'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const now = new Date().toISOString();
    let stepCount = 0;
    let shapeCount = 0;
    const errors: string[] = [];
    for (const u of args.updates) {
      const patch: Record<string, unknown> = { updated_at: now };
      if (u.kind === 'step') {
        if (u.x !== undefined) patch.board_x = Math.round(u.x);
        if (u.y !== undefined) patch.board_y = Math.round(u.y);
        if (Object.keys(patch).length <= 1) continue;
        const { error } = await sb.from('funnel_steps').update(patch).eq('id', u.id).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId);
        if (error) errors.push(`step ${u.id}: ${error.message}`);
        else stepCount++;
      } else {
        if (u.x !== undefined) patch.x = Math.round(u.x);
        if (u.y !== undefined) patch.y = Math.round(u.y);
        if (u.width !== undefined) patch.width = u.width;
        if (u.height !== undefined) patch.height = u.height;
        if (Object.keys(patch).length <= 1) continue;
        const { error } = await sb.from('funnel_board_shapes').update(patch).eq('id', u.id).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId);
        if (error) errors.push(`shape ${u.id}: ${error.message}`);
        else shapeCount++;
      }
    }
    const parts = [];
    if (stepCount) parts.push(`${stepCount} step${stepCount > 1 ? 's' : ''}`);
    if (shapeCount) parts.push(`${shapeCount} shape${shapeCount > 1 ? 's' : ''}`);
    if (errors.length) parts.push(`${errors.length} failed`);
    return txt(`Updated ${parts.join(', ') || '0 nodes'}.${errors.length ? ' Errors: ' + errors.join('; ') : ''}`);
  });

  // ── Funnel Tab tools ──

  server.tool('list_funnel_tabs', 'List all tabs for a funnel. Returns empty array if the funnel has no tabs (legacy single-canvas mode).', {
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async ({ funnelId, companyId }, extra) => {
    const resolved = await resolveAuthForFunnel(extra, funnelId, companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_tabs')
      .select('id, name, position, created_at')
      .eq('funnel_id', funnelId)
      .eq('company_id', auth.companyId)
      .order('position');
    if (error) return txt(`Error: ${error.message}`);
    return json(data || []);
  });

  server.tool('create_funnel_tab', 'Create a new tab in a funnel. If this is the first tab, all existing content (steps, shapes, edges, notes) is automatically reassigned to it.', {
    funnelId: z.string(),
    name: z.string().describe('Tab name'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: existing } = await sb.from('funnel_tabs')
      .select('id')
      .eq('funnel_id', args.funnelId)
      .eq('company_id', auth.companyId);
    const isFirst = !existing || existing.length === 0;
    const maxPos = isFirst ? 0 : (await sb.from('funnel_tabs')
      .select('position')
      .eq('funnel_id', args.funnelId)
      .order('position', { ascending: false })
      .limit(1)
      .single()).data?.position ?? 0;
    const { data, error } = await sb.from('funnel_tabs').insert({
      funnel_id: args.funnelId,
      company_id: auth.companyId,
      name: args.name,
      position: isFirst ? 0 : maxPos + 1,
    }).select('id, name, position').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    if (isFirst) {
      await Promise.all([
        sb.from('funnel_steps').update({ tab_id: data.id }).eq('funnel_id', args.funnelId).is('tab_id', null),
        sb.from('funnel_board_edges').update({ tab_id: data.id }).eq('funnel_id', args.funnelId).is('tab_id', null),
        sb.from('funnel_board_shapes').update({ tab_id: data.id }).eq('funnel_id', args.funnelId).is('tab_id', null),
        sb.from('funnel_board_notes').update({ tab_id: data.id }).eq('funnel_id', args.funnelId).is('tab_id', null),
      ]);
    }
    return json({ id: data.id, name: data.name, position: data.position, backfilledExisting: isFirst });
  });

  server.tool('update_funnel_tab', 'Rename a funnel tab.', {
    tabId: z.string(),
    funnelId: z.string(),
    name: z.string().describe('New tab name'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const sb = createServiceClient();
    const { error } = await sb.from('funnel_tabs')
      .update({ name: args.name, updated_at: new Date().toISOString() })
      .eq('id', args.tabId)
      .eq('funnel_id', args.funnelId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Tab renamed.');
  });

  server.tool('delete_funnel_tab', 'Delete a funnel tab and all its content (steps, shapes, edges, notes). Cannot delete the last tab.', {
    tabId: z.string(),
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: tabs } = await sb.from('funnel_tabs')
      .select('id')
      .eq('funnel_id', args.funnelId)
      .eq('company_id', auth.companyId);
    if (!tabs || tabs.length <= 1) return txt('Cannot delete the last tab.');
    const { error } = await sb.from('funnel_tabs').delete().eq('id', args.tabId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Tab deleted (all content cascaded).');
  });

  // ── Funnel Template tools ──

  server.tool('list_funnel_templates', 'List saved funnel templates. These are reusable funnel blueprints that can be stamped into new funnels.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnels')
      .select('id, name, description, currency, forecast_period, created_at, updated_at')
      .eq('company_id', auth.companyId)
      .eq('is_template', true)
      .order('updated_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No funnel templates found.');
    return json(data);
  });

  server.tool('save_funnel_as_template', 'Save an existing funnel as a reusable template. Clones all steps, edges, shapes, and notes into a new template entry.', {
    funnelId: z.string().describe('Source funnel to clone as a template'),
    name: z.string().optional().describe('Template name (defaults to source funnel name)'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: source } = await sb.from('funnels').select('*').eq('id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!source) return txt('Funnel not found');

    const [stepsRes, edgesRes, notesRes, shapesRes] = await Promise.all([
      sb.from('funnel_steps').select('*').eq('funnel_id', source.id),
      sb.from('funnel_board_edges').select('*').eq('funnel_id', source.id),
      sb.from('funnel_board_notes').select('*').eq('funnel_id', source.id),
      sb.from('funnel_board_shapes').select('*').eq('funnel_id', source.id),
    ]);

    const { data: newFunnel, error: fErr } = await sb.from('funnels').insert({
      company_id: auth.companyId,
      name: args.name || source.name,
      description: source.description,
      currency: source.currency,
      forecast_period: source.forecast_period,
      parent_funnel_id: null,
      is_template: true,
      created_by: auth.userId,
    }).select('id, name').single();
    if (fErr || !newFunnel) return txt(`Failed: ${fErr?.message || 'unknown'}`);

    const stepIdMap = new Map<string, string>();
    const srcSteps = stepsRes.data || [];
    if (srcSteps.length > 0) {
      const rows = srcSteps.map((s: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        step_type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
        board_x: s.board_x, board_y: s.board_y, metrics: s.metrics, linked_funnel_id: s.linked_funnel_id,
      }));
      const { data: inserted } = await sb.from('funnel_steps').insert(rows).select('id');
      inserted?.forEach((row: { id: string }, i: number) => { stepIdMap.set((srcSteps[i] as { id: string }).id, row.id); });
    }

    const shapeIdMap = new Map<string, string>();
    const srcShapes = shapesRes.data || [];
    if (srcShapes.length > 0) {
      const rows = srcShapes.map((sh: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        shape_type: sh.shape_type, x: sh.x, y: sh.y, width: sh.width, height: sh.height,
        end_x: sh.end_x, end_y: sh.end_y, content: sh.content,
        color: sh.color, stroke_width: sh.stroke_width, dashed: sh.dashed, font_size: sh.font_size, linked_funnel_id: sh.linked_funnel_id,
      }));
      const { data: inserted } = await sb.from('funnel_board_shapes').insert(rows).select('id');
      inserted?.forEach((row: { id: string }, i: number) => { shapeIdMap.set((srcShapes[i] as { id: string }).id, row.id); });
    }

    const srcNotes = notesRes.data || [];
    if (srcNotes.length > 0) {
      await sb.from('funnel_board_notes').insert(srcNotes.map((n: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        content: n.content, color: n.color,
        board_x: n.board_x, board_y: n.board_y,
        width: n.width, height: n.height, font_size: n.font_size,
      })));
    }

    const srcEdges = edgesRes.data || [];
    if (srcEdges.length > 0) {
      const rows = srcEdges
        .map((e: Record<string, unknown>) => {
          const newSrcStep = e.source_step_id ? stepIdMap.get(e.source_step_id as string) : null;
          const newTgtStep = e.target_step_id ? stepIdMap.get(e.target_step_id as string) : null;
          const newSrcShape = e.source_shape_id ? shapeIdMap.get(e.source_shape_id as string) : null;
          const newTgtShape = e.target_shape_id ? shapeIdMap.get(e.target_shape_id as string) : null;
          if (e.source_step_id && !newSrcStep) return null;
          if (e.target_step_id && !newTgtStep) return null;
          if (e.source_shape_id && !newSrcShape) return null;
          if (e.target_shape_id && !newTgtShape) return null;
          return {
            funnel_id: newFunnel.id, company_id: auth.companyId,
            source_step_id: newSrcStep ?? null, target_step_id: newTgtStep ?? null,
            source_shape_id: newSrcShape ?? null, target_shape_id: newTgtShape ?? null,
            source_handle: e.source_handle, target_handle: e.target_handle,
            label: e.label, edge_type: e.edge_type, animated: e.animated,
            split_percent: e.split_percent, style: e.style,
          };
        })
        .filter((r: unknown): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) await sb.from('funnel_board_edges').insert(rows);
    }

    return json({ id: newFunnel.id, name: newFunnel.name, isTemplate: true });
  });

  server.tool('create_funnel_from_template', 'Create a new funnel pre-populated from a saved template. Clones all steps, edges, shapes, and notes.', {
    templateId: z.string().describe('Template funnel ID (from list_funnel_templates)'),
    name: z.string().describe('Name for the new funnel'),
    description: z.string().optional(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the template'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.templateId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: template } = await sb.from('funnels').select('*').eq('id', args.templateId).eq('company_id', auth.companyId).eq('is_template', true).single();
    if (!template) return txt('Template not found');

    const [stepsRes, edgesRes, notesRes, shapesRes] = await Promise.all([
      sb.from('funnel_steps').select('*').eq('funnel_id', template.id),
      sb.from('funnel_board_edges').select('*').eq('funnel_id', template.id),
      sb.from('funnel_board_notes').select('*').eq('funnel_id', template.id),
      sb.from('funnel_board_shapes').select('*').eq('funnel_id', template.id),
    ]);

    const { data: newFunnel, error: fErr } = await sb.from('funnels').insert({
      company_id: auth.companyId,
      name: args.name,
      description: args.description || template.description,
      currency: template.currency,
      forecast_period: template.forecast_period,
      parent_funnel_id: null,
      is_template: false,
      created_by: auth.userId,
    }).select('id, name').single();
    if (fErr || !newFunnel) return txt(`Failed: ${fErr?.message || 'unknown'}`);

    const stepIdMap = new Map<string, string>();
    const srcSteps = stepsRes.data || [];
    if (srcSteps.length > 0) {
      const rows = srcSteps.map((s: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        step_type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
        board_x: s.board_x, board_y: s.board_y, metrics: s.metrics, linked_funnel_id: s.linked_funnel_id,
      }));
      const { data: inserted } = await sb.from('funnel_steps').insert(rows).select('id');
      inserted?.forEach((row: { id: string }, i: number) => { stepIdMap.set((srcSteps[i] as { id: string }).id, row.id); });
    }

    const shapeIdMap = new Map<string, string>();
    const srcShapes = shapesRes.data || [];
    if (srcShapes.length > 0) {
      const rows = srcShapes.map((sh: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        shape_type: sh.shape_type, x: sh.x, y: sh.y, width: sh.width, height: sh.height,
        end_x: sh.end_x, end_y: sh.end_y, content: sh.content,
        color: sh.color, stroke_width: sh.stroke_width, dashed: sh.dashed, font_size: sh.font_size, linked_funnel_id: sh.linked_funnel_id,
      }));
      const { data: inserted } = await sb.from('funnel_board_shapes').insert(rows).select('id');
      inserted?.forEach((row: { id: string }, i: number) => { shapeIdMap.set((srcShapes[i] as { id: string }).id, row.id); });
    }

    const srcNotes = notesRes.data || [];
    if (srcNotes.length > 0) {
      await sb.from('funnel_board_notes').insert(srcNotes.map((n: Record<string, unknown>) => ({
        funnel_id: newFunnel.id, company_id: auth.companyId,
        content: n.content, color: n.color,
        board_x: n.board_x, board_y: n.board_y,
        width: n.width, height: n.height, font_size: n.font_size,
      })));
    }

    const srcEdges = edgesRes.data || [];
    if (srcEdges.length > 0) {
      const rows = srcEdges
        .map((e: Record<string, unknown>) => {
          const newSrcStep = e.source_step_id ? stepIdMap.get(e.source_step_id as string) : null;
          const newTgtStep = e.target_step_id ? stepIdMap.get(e.target_step_id as string) : null;
          const newSrcShape = e.source_shape_id ? shapeIdMap.get(e.source_shape_id as string) : null;
          const newTgtShape = e.target_shape_id ? shapeIdMap.get(e.target_shape_id as string) : null;
          if (e.source_step_id && !newSrcStep) return null;
          if (e.target_step_id && !newTgtStep) return null;
          if (e.source_shape_id && !newSrcShape) return null;
          if (e.target_shape_id && !newTgtShape) return null;
          return {
            funnel_id: newFunnel.id, company_id: auth.companyId,
            source_step_id: newSrcStep ?? null, target_step_id: newTgtStep ?? null,
            source_shape_id: newSrcShape ?? null, target_shape_id: newTgtShape ?? null,
            source_handle: e.source_handle, target_handle: e.target_handle,
            label: e.label, edge_type: e.edge_type, animated: e.animated,
            split_percent: e.split_percent, style: e.style,
          };
        })
        .filter((r: unknown): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) await sb.from('funnel_board_edges').insert(rows);
    }

    return json({ id: newFunnel.id, name: newFunnel.name });
  });

  // ── Board section tools ──
  //
  // Sections are labelled background regions ("Lead Generation", "Onboarding")
  // drawn behind the nodes. Membership is POSITIONAL — a node belongs to a
  // section when it sits inside its bounds — so there is nothing to assign;
  // place the section's rectangle over the nodes it should contain.

  server.tool('list_funnel_sections', 'List the labelled background sections on a funnel.', {
    funnelId: z.string(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_board_sections')
      .select('id, label, color, x, y, width, height, tab_id, locked')
      .eq('funnel_id', args.funnelId).eq('company_id', resolved.auth.companyId)
      .order('created_at');
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return json((data || []).map(sec => ({
      id: sec.id, label: sec.label, color: sec.color,
      x: sec.x, y: sec.y, width: sec.width, height: sec.height,
      tabId: sec.tab_id, locked: sec.locked,
    })));
  });

  server.tool('create_funnel_section', 'Draw a labelled background region behind the nodes. Nodes belong to it by sitting inside its bounds — size the rectangle to cover the nodes it should group.', {
    funnelId: z.string(),
    label: z.string().describe('Shown above the region, e.g. "Lead Generation"'),
    x: z.number(), y: z.number(),
    width: z.number(), height: z.number(),
    color: z.enum(['teal', 'blue', 'purple', 'amber', 'rose', 'green', 'slate']).optional().describe('Default: teal'),
    tabId: z.string().optional().describe('Tab this section belongs to (required when the funnel has tabs)'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_board_sections').insert({
      funnel_id: args.funnelId,
      company_id: resolved.auth.companyId,
      label: args.label,
      color: args.color || 'teal',
      x: Math.round(args.x), y: Math.round(args.y),
      width: Math.round(args.width), height: Math.round(args.height),
      tab_id: args.tabId || null,
    }).select('id').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json({ id: data.id });
  });

  server.tool('update_funnel_section', 'Update a section label, colour, position or size.', {
    sectionId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
    label: z.string().optional(),
    color: z.enum(['teal', 'blue', 'purple', 'amber', 'rose', 'green', 'slate']).optional(),
    x: z.number().optional(), y: z.number().optional(),
    width: z.number().optional(), height: z.number().optional(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const sb = createServiceClient();
    const { data: sec } = await sb.from('funnel_board_sections').select('id')
      .eq('id', args.sectionId).eq('funnel_id', args.funnelId)
      .eq('company_id', resolved.auth.companyId).single();
    if (!sec) return txt('Section not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.label !== undefined) patch.label = args.label;
    if (args.color !== undefined) patch.color = args.color;
    if (args.x !== undefined) patch.x = Math.round(args.x);
    if (args.y !== undefined) patch.y = Math.round(args.y);
    if (args.width !== undefined) patch.width = Math.round(args.width);
    if (args.height !== undefined) patch.height = Math.round(args.height);
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_board_sections').update(patch).eq('id', args.sectionId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Section updated.');
  });

  server.tool('delete_funnel_section', 'Remove a section outline. Nodes inside it are untouched.', {
    sectionId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const sb = createServiceClient();
    const { error } = await sb.from('funnel_board_sections').delete()
      .eq('id', args.sectionId).eq('funnel_id', args.funnelId)
      .eq('company_id', resolved.auth.companyId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Section deleted.');
  });

  // ── Role tools ──
  //
  // A role is a coloured LABEL describing who owns a step ("Sales Rep", "Me").
  // It is deliberately NOT a user account — creating one invites nobody and
  // grants no access. Roles are company-scoped and reusable across funnels.

  server.tool('list_funnel_roles', 'List the company\'s funnel roles. Roles are plain labels for who owns a step — not user accounts.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_roles')
      .select('id, name, color').eq('company_id', auth.companyId).order('name');
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return json(data || []);
  });

  server.tool('create_funnel_role', 'Create a role label (e.g. "Account Manager"). Assigning it to a node marks who owns that step — it does not invite anyone or grant access. Reusable across every funnel in the company.', {
    name: z.string(),
    color: z.string().optional().describe('Hex colour, e.g. "#017C87". Defaults to one derived from the name.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const name = args.name.trim();
    if (!name) return txt('Role name is required.');
    // Names are unique per company, case-insensitively — return the existing
    // row rather than erroring so this is safe to call repeatedly.
    const { data: existing } = await sb.from('funnel_roles')
      .select('id, name, color').eq('company_id', auth.companyId).ilike('name', name).maybeSingle();
    if (existing) return json({ ...existing, existing: true });
    const { data, error } = await sb.from('funnel_roles').insert({
      company_id: auth.companyId,
      name,
      color: args.color || defaultRoleColor(name),
    }).select('id, name, color').single();
    if (error || !data) return txt(`Failed: ${friendlyError(error?.message || 'unknown')}`);
    return json(data);
  });

  server.tool('list_funnel_logos', 'List the company\'s uploaded platform logos. Pass a logo\'s url as the `platform` argument on a step or shape to badge that node with it. Uploading is done in the app UI, not over MCP.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('funnel_custom_logos')
      .select('id, name, url').eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return json(data || []);
  });

  server.tool('delete_funnel_role', 'Delete a role label. Nodes using it keep their place and simply lose the owner marker.', {
    roleId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { error } = await sb.from('funnel_roles').delete()
      .eq('id', args.roleId).eq('company_id', auth.companyId);
    if (error) return txt(`Failed: ${friendlyError(error.message)}`);
    return txt('Role deleted.');
  });
}
