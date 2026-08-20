import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import { BOARD_ACTION_GROUPS } from '@/lib/types/board-actions';

const NODE_TYPE_CATALOG = buildNodeTypeCatalog();

function buildNodeTypeCatalog() {
  const sources: Record<string, { slug: string; label: string; icon: string }[]> = {
    paid: [], search: [], social: [], other: [], crm: [], messaging: [], other_sites: [], offline: [],
  };
  const pages: { slug: string; label: string; icon: string }[] = [];
  const offers: { slug: string; label: string; icon: string }[] = [];

  for (const [slug, d] of Object.entries(FUNNEL_STEP_DEFAULTS)) {
    const entry = { slug, label: d.label, icon: d.icon };
    if (slug.startsWith('traffic_')) {
      if (slug.endsWith('_ads') || slug === 'traffic_paid' || slug === 'traffic_native_ads') sources.paid.push(entry);
      else if (['traffic_organic', 'traffic_google_organic', 'traffic_bing_organic', 'traffic_youtube_organic'].includes(slug)) sources.search.push(entry);
      else if (['traffic_facebook_organic', 'traffic_instagram_organic', 'traffic_linkedin_organic', 'traffic_tiktok_organic', 'traffic_twitter_organic', 'traffic_pinterest_organic', 'traffic_reddit_organic', 'traffic_organic_social'].includes(slug)) sources.social.push(entry);
      else if (['traffic_direct', 'traffic_referral', 'traffic_affiliate'].includes(slug)) sources.other.push(entry);
      else if (['traffic_hubspot', 'traffic_ghl', 'traffic_activecampaign', 'traffic_salesforce', 'traffic_simpro', 'traffic_aroflo', 'traffic_workflowmax', 'traffic_servicem8', 'traffic_fergus', 'traffic_ascora', 'traffic_jobber'].includes(slug)) sources.crm.push(entry);
      else if (['traffic_slack', 'traffic_messenger', 'traffic_chatbot'].includes(slug)) sources.messaging.push(entry);
      else if (['traffic_zoho', 'traffic_yelp', 'traffic_amazon', 'traffic_zoom', 'traffic_gmail', 'traffic_spotify', 'traffic_snapchat_organic', 'traffic_google_maps'].includes(slug)) sources.other_sites.push(entry);
      else if (['traffic_print_ad', 'traffic_conference', 'traffic_online_meeting', 'traffic_direct_mail', 'traffic_meeting', 'traffic_billboard', 'traffic_business_card', 'traffic_phone', 'traffic_report', 'traffic_qr_code', 'traffic_offline', 'traffic_podcast', 'traffic_influencer'].includes(slug)) sources.offline.push(entry);
      else if (['traffic_email', 'traffic_sms'].includes(slug)) sources.messaging.push(entry);
    } else if (slug.startsWith('page_')) pages.push(entry);
    else if (slug.startsWith('offer_')) offers.push(entry);
  }

  const actions: Record<string, { slug: string; label: string; icon: string }[]> = {};
  for (const g of BOARD_ACTION_GROUPS) {
    actions[g.key] = g.items.map(i => ({ slug: i.shapeType, label: i.label, icon: i.iconName }));
  }

  const drawing = [
    { slug: 'rectangle', label: 'Rectangle', icon: 'square' },
    { slug: 'ellipse', label: 'Ellipse', icon: 'circle' },
    { slug: 'arrow', label: 'Arrow', icon: 'move-right' },
    { slug: 'line', label: 'Line', icon: 'minus' },
    { slug: 'text', label: 'Text', icon: 'type' },
  ];

  return { sources, pages, offers, actions, drawing };
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
    category: z.enum(['all', 'sources', 'pages', 'offers', 'actions', 'drawing']).optional().describe('Filter to a specific category. Default: all'),
  }, async ({ category }) => {
    const cat = category || 'all';
    const result: Record<string, unknown> = {};
    if (cat === 'all' || cat === 'sources') result.sources = { note: 'Use with create_funnel_step (stepType)', groups: NODE_TYPE_CATALOG.sources };
    if (cat === 'all' || cat === 'pages') result.pages = { note: 'Use with create_funnel_step (stepType)', items: NODE_TYPE_CATALOG.pages };
    if (cat === 'all' || cat === 'offers') result.offers = { note: 'Use with create_funnel_step (stepType)', items: NODE_TYPE_CATALOG.offers };
    if (cat === 'all' || cat === 'actions') result.actions = { note: 'Use with create_funnel_shape (shapeType)', groups: NODE_TYPE_CATALOG.actions };
    if (cat === 'all' || cat === 'drawing') result.drawing = { note: 'Use with create_funnel_shape (shapeType)', items: NODE_TYPE_CATALOG.drawing };
    if (cat === 'all') {
      result._summary = {
        stepTypes: 'traffic_*, page_*, offer_*, generic → use create_funnel_step',
        shapeTypes: 'action nodes + drawing primitives → use create_funnel_shape',
      };
    }
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
      .eq('company_id', auth.companyId).order('updated_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No funnels found.');
    return json(data);
  });

  server.tool('get_funnel', 'Get funnel detail with all steps, edges, and shapes.', {
    funnelId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ funnelId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: funnel } = await sb.from('funnels').select('*').eq('id', funnelId).eq('company_id', auth.companyId).single();
    if (!funnel) return txt('Funnel not found');
    const [{ data: steps }, { data: edges }, { data: shapes }] = await Promise.all([
      sb.from('funnel_steps').select('id, step_type, label, icon, url, color, board_x, board_y, metrics, created_at').eq('funnel_id', funnelId).eq('company_id', auth.companyId),
      sb.from('funnel_board_edges').select('id, source_step_id, source_shape_id, target_step_id, target_shape_id, source_handle, target_handle, label, edge_type, animated, split_percent, style').eq('funnel_id', funnelId).eq('company_id', auth.companyId),
      sb.from('funnel_board_shapes').select('id, shape_type, x, y, width, height, content, color').eq('funnel_id', funnelId).eq('company_id', auth.companyId),
    ]);
    return json({
      id: funnel.id, name: funnel.name, description: funnel.description, status: funnel.status,
      currency: funnel.currency, forecastPeriod: funnel.forecast_period, defaultDealValue: funnel.default_deal_value,
      isTemplate: funnel.is_template,
      createdAt: funnel.created_at, updatedAt: funnel.updated_at,
      steps: (steps || []).map(s => ({
        id: s.id, type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
        position: { x: s.board_x, y: s.board_y }, metrics: s.metrics,
      })),
      edges: (edges || []).map(e => ({
        id: e.id, sourceStepId: e.source_step_id, sourceShapeId: e.source_shape_id,
        targetStepId: e.target_step_id, targetShapeId: e.target_shape_id,
        sourceHandle: e.source_handle, targetHandle: e.target_handle,
        label: e.label, edgeType: e.edge_type, animated: e.animated,
        splitPercent: e.split_percent, style: e.style,
      })),
      shapes: (shapes || []).map(s => ({
        id: s.id, type: s.shape_type, x: s.x, y: s.y, width: s.width, height: s.height,
        content: s.content, color: s.color,
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
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
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
    if (error) return txt(`Failed: ${error.message}`);
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
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Funnel "${f.name}" deleted.`);
  });

  server.tool('create_funnel_step', 'Add a step (node) to a funnel. Use list_funnel_node_types to see valid stepType values. Returns the new step ID.', {
    funnelId: z.string(),
    stepType: z.string().describe('Step type slug — call list_funnel_node_types to see all valid values'),
    label: z.string().describe('Display label for the node'),
    x: z.number().describe('Canvas X coordinate'),
    y: z.number().describe('Canvas Y coordinate'),
    icon: z.string().optional().describe('Lucide icon name or brand slug (e.g. "facebook", "search")'),
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
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel. Super admin: override to target a different company'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
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
    }).select('id, step_type, label, board_x, board_y').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, type: data.step_type, label: data.label, position: { x: data.board_x, y: data.board_y } });
  });

  server.tool('update_funnel_step', 'Update a step node (label, position, metrics, icon, color, URL, stepType). No need to delete and recreate to change type.', {
    stepId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
    stepType: z.string().optional().describe('Change the step type — call list_funnel_node_types for valid values'),
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    icon: z.string().optional(),
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
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
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
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_steps').update(patch).eq('id', args.stepId);
    if (error) return txt(`Failed: ${error.message}`);
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
    if (error) return txt(`Failed: ${error.message}`);
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
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    if (!args.sourceStepId && !args.sourceShapeId) return txt('Provide either sourceStepId or sourceShapeId.');
    if (!args.targetStepId && !args.targetShapeId) return txt('Provide either targetStepId or targetShapeId.');
    const sb = createServiceClient();
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
      style: { stroke: '#2B2B2B', strokeWidth: 2 },
    }).select('id').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, label: args.label || null });
  });

  server.tool('update_funnel_edge', 'Update an edge (label, handles, animation, split percent).', {
    edgeId: z.string(),
    funnelId: z.string(),
    label: z.string().optional(),
    sourceHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
    targetHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
    animated: z.boolean().optional(),
    splitPercent: z.number().optional(),
    edgeType: z.string().optional(),
    companyId: z.string().optional().describe('Optional — auto-resolved from the funnel'),
  }, async (args, extra) => {
    const resolved = await resolveAuthForFunnel(extra, args.funnelId, args.companyId);
    if (!resolved) return unauthorized();
    const { auth } = resolved;
    const sb = createServiceClient();
    const { data: e } = await sb.from('funnel_board_edges').select('id').eq('id', args.edgeId).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!e) return txt('Edge not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.label !== undefined) patch.label = args.label;
    if (args.sourceHandle !== undefined) patch.source_handle = args.sourceHandle;
    if (args.targetHandle !== undefined) patch.target_handle = args.targetHandle;
    if (args.animated !== undefined) patch.animated = args.animated;
    if (args.splitPercent !== undefined) patch.split_percent = args.splitPercent;
    if (args.edgeType !== undefined) patch.edge_type = args.edgeType;
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_board_edges').update(patch).eq('id', args.edgeId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Edge updated.');
  });

  // ── Shape (annotation/sticky-note) tools ──

  server.tool('create_funnel_shape', 'Add a shape (sticky note, annotation, decision diamond, action node, etc.) to a funnel board. Returns the new shape ID.', {
    funnelId: z.string(),
    shapeType: z.string().describe('Shape type — primitives: rectangle, ellipse, arrow, line, text. Actions: decision, wait, call, meeting, automation, goal, button_click, form_submit, video_play, scroll_depth, purchase, add_to_cart, subscribe, custom_event, page_view, time_on_page, exit_intent, refund, download, share, login, sms_notification, email_notification, ghl_notification, google_sheet, webhook, form_completed, schedule_meeting, deal_won, send_quote, send_google_review, add_to_referral_program, etc.'),
    x: z.number().describe('Canvas X coordinate'),
    y: z.number().describe('Canvas Y coordinate'),
    content: z.string().optional().describe('Text content (for text shapes, sticky notes, labels)'),
    width: z.number().optional().describe('Width in pixels'),
    height: z.number().optional().describe('Height in pixels'),
    color: z.string().optional().describe('Hex color (default: #2B2B2B)'),
    strokeWidth: z.number().optional().describe('Stroke width (default: 2)'),
    dashed: z.boolean().optional().describe('Dashed stroke (default: false)'),
    fontSize: z.number().optional().describe('Font size for text shapes'),
    endX: z.number().optional().describe('End X for arrow/line shapes'),
    endY: z.number().optional().describe('End Y for arrow/line shapes'),
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
    }).select('id, shape_type, x, y').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, type: data.shape_type, position: { x: data.x, y: data.y } });
  });

  server.tool('update_funnel_shape', 'Update a shape (position, size, content, color, stroke).', {
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
    if (Object.keys(patch).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('funnel_board_shapes').update(patch).eq('id', args.shapeId);
    if (error) return txt(`Failed: ${error.message}`);
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
    if (error) return txt(`Failed: ${error.message}`);
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
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Edge deleted.');
  });
}
