import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerFunnelTools(server: McpServer) {
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

  server.tool('create_funnel_step', 'Add a step (node) to a funnel. Step types: traffic_* (sources), page_* (pages), offer_* (offers), generic. Returns the new step ID.', {
    funnelId: z.string(),
    stepType: z.string().describe('Step type (e.g. traffic_facebook_ads, page_landing, offer_product, generic)'),
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('funnels').select('id').eq('id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Funnel not found');
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

  server.tool('update_funnel_step', 'Update a step node (label, position, metrics, icon, color, URL).', {
    stepId: z.string(),
    funnelId: z.string().describe('Funnel ID for ownership verification'),
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: step } = await sb.from('funnel_steps').select('id').eq('id', args.stepId).eq('funnel_id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!step) return txt('Step not found');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ stepId, funnelId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: f } = await sb.from('funnels').select('id').eq('id', args.funnelId).eq('company_id', auth.companyId).single();
    if (!f) return txt('Funnel not found');
    if (!args.sourceStepId && !args.sourceShapeId) return txt('Provide either sourceStepId or sourceShapeId.');
    if (!args.targetStepId && !args.targetShapeId) return txt('Provide either targetStepId or targetShapeId.');
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
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
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

  server.tool('delete_funnel_edge', 'Delete an edge (connection) from a funnel.', {
    edgeId: z.string(),
    funnelId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ edgeId, funnelId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: e } = await sb.from('funnel_board_edges').select('id').eq('id', edgeId).eq('funnel_id', funnelId).eq('company_id', auth.companyId).single();
    if (!e) return txt('Edge not found');
    const { error } = await sb.from('funnel_board_edges').delete().eq('id', edgeId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Edge deleted.');
  });
}
