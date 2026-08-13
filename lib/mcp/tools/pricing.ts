import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

function resolvePageTable(args: { proposalId?: string; templateId?: string }) {
  if (args.proposalId && args.templateId) return 'ambiguous' as const;
  if (args.templateId) return { table: 'template_pages_v2' as const, fk: 'template_id', entityId: args.templateId };
  if (args.proposalId) return { table: 'proposal_pages_v2' as const, fk: 'proposal_id', entityId: args.proposalId };
  return null;
}

export function registerPricingTools(server: McpServer) {
  server.tool('get_pricing_page', 'Get the full pricing data for a pricing page (line items, tax, payment schedule, column config). Works on proposal or template pages.', {
    proposalId: z.string().optional().describe('Proposal ID (provide proposalId OR templateId)'),
    templateId: z.string().optional().describe('Template ID (provide proposalId OR templateId)'),
    pageId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const ctx = resolvePageTable(args);
    if (ctx === 'ambiguous') return txt('Provide proposalId OR templateId, not both.');
    if (!ctx) return txt('Provide either proposalId or templateId.');
    const sb = createServiceClient();
    const { data: page } = await sb.from(ctx.table)
      .select('id, type, title, payload, enabled, position')
      .eq('id', args.pageId).eq(ctx.fk, ctx.entityId).eq('company_id', auth.companyId).single();
    if (!page) return txt('Page not found');
    if (page.type !== 'pricing') return txt(`Page is type "${page.type}", not "pricing".`);
    const pl = (page.payload ?? {}) as Record<string, unknown>;
    return json({
      id: page.id, title: page.title, enabled: page.enabled, position: page.position,
      items: pl.items || [],
      optionalItems: pl.optional_items || [],
      introText: pl.intro_text || null,
      taxEnabled: pl.tax_enabled ?? true,
      taxRate: pl.tax_rate ?? 10,
      taxLabel: pl.tax_label ?? 'GST (10%)',
      validityDays: pl.validity_days ?? null,
      qtyEnabled: pl.qty_enabled ?? false,
      paymentSchedule: pl.payment_schedule || null,
      footerNote: pl.footer_note || null,
    });
  });

  server.tool('set_pricing_line_items', 'Set the full line items array on a pricing page. Replaces existing items. Works on proposal or template pages.', {
    proposalId: z.string().optional().describe('Proposal ID (provide proposalId OR templateId)'),
    templateId: z.string().optional().describe('Template ID (provide proposalId OR templateId)'),
    pageId: z.string(),
    items: z.array(z.object({
      id: z.string().describe('Unique ID (e.g. "li_1"). Must be stable across updates'),
      label: z.string(),
      description: z.string().optional(),
      amount: z.number().describe('Line total (or qty × unit_price when qty is enabled)'),
      sort_order: z.number(),
      qty: z.number().optional(),
      unit_price: z.number().optional(),
      discount_pct: z.number().optional().describe('0-100 discount percentage'),
      percentage: z.number().optional().describe('Display-only column. Usually 0'),
    })),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const ctx = resolvePageTable(args);
    if (ctx === 'ambiguous') return txt('Provide proposalId OR templateId, not both.');
    if (!ctx) return txt('Provide either proposalId or templateId.');
    const sb = createServiceClient();
    const { data: page } = await sb.from(ctx.table)
      .select('id, type, payload').eq('id', args.pageId).eq(ctx.fk, ctx.entityId).eq('company_id', auth.companyId).single();
    if (!page) return txt('Page not found');
    if (page.type !== 'pricing') return txt(`Page is type "${page.type}", not "pricing".`);
    const payload = { ...((page.payload ?? {}) as Record<string, unknown>), items: args.items.map(i => ({ ...i, description: i.description || '', percentage: i.percentage ?? 0 })) };
    const { error } = await sb.from(ctx.table).update({ payload, updated_at: new Date().toISOString() }).eq('id', args.pageId).eq('company_id', auth.companyId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`${args.items.length} line item${args.items.length !== 1 ? 's' : ''} saved.`);
  });

  server.tool('set_pricing_settings', 'Update pricing page settings (tax, intro text, payment schedule, column visibility). Works on proposal or template pages.', {
    proposalId: z.string().optional().describe('Proposal ID (provide proposalId OR templateId)'),
    templateId: z.string().optional().describe('Template ID (provide proposalId OR templateId)'),
    pageId: z.string(),
    introText: z.string().optional(),
    taxEnabled: z.boolean().optional(),
    taxRate: z.number().optional(),
    taxLabel: z.string().optional(),
    validityDays: z.number().optional(),
    qtyEnabled: z.boolean().optional(),
    footerNote: z.string().optional(),
    paymentSchedule: z.object({
      one_off: z.object({ enabled: z.boolean(), amount: z.number(), label: z.string(), note: z.string() }).optional(),
      milestones: z.object({
        enabled: z.boolean(),
        payments: z.array(z.object({ id: z.string(), label: z.string(), type: z.enum(['percentage', 'fixed']), value: z.number(), note: z.string() })),
      }).optional(),
      recurring: z.object({ enabled: z.boolean(), amount: z.number(), frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']), label: z.string(), note: z.string() }).optional(),
    }).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const ctx = resolvePageTable(args);
    if (ctx === 'ambiguous') return txt('Provide proposalId OR templateId, not both.');
    if (!ctx) return txt('Provide either proposalId or templateId.');
    const sb = createServiceClient();
    const { data: page } = await sb.from(ctx.table)
      .select('id, type, payload').eq('id', args.pageId).eq(ctx.fk, ctx.entityId).eq('company_id', auth.companyId).single();
    if (!page) return txt('Page not found');
    if (page.type !== 'pricing') return txt(`Page is type "${page.type}", not "pricing".`);
    const payload = { ...((page.payload ?? {}) as Record<string, unknown>) };
    const MAP: [string, string][] = [
      ['introText', 'intro_text'], ['taxEnabled', 'tax_enabled'], ['taxRate', 'tax_rate'],
      ['taxLabel', 'tax_label'], ['validityDays', 'validity_days'], ['qtyEnabled', 'qty_enabled'],
      ['footerNote', 'footer_note'], ['paymentSchedule', 'payment_schedule'],
    ];
    let count = 0;
    for (const [param, key] of MAP) {
      const val = (args as Record<string, unknown>)[param];
      if (val !== undefined) { payload[key] = val; count++; }
    }
    if (count === 0) return txt('No fields to update.');
    const { error } = await sb.from(ctx.table).update({ payload, updated_at: new Date().toISOString() }).eq('id', args.pageId).eq('company_id', auth.companyId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Pricing settings updated (${count} field${count > 1 ? 's' : ''}).`);
  });

  server.tool('get_packages_page', 'Get the full packages data for a packages page (tiers, features, styling). Works on proposal or template pages.', {
    proposalId: z.string().optional().describe('Proposal ID (provide proposalId OR templateId)'),
    templateId: z.string().optional().describe('Template ID (provide proposalId OR templateId)'),
    pageId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const ctx = resolvePageTable(args);
    if (ctx === 'ambiguous') return txt('Provide proposalId OR templateId, not both.');
    if (!ctx) return txt('Provide either proposalId or templateId.');
    const sb = createServiceClient();
    const { data: page } = await sb.from(ctx.table)
      .select('id, type, title, payload, enabled, position')
      .eq('id', args.pageId).eq(ctx.fk, ctx.entityId).eq('company_id', auth.companyId).single();
    if (!page) return txt('Page not found');
    if (page.type !== 'packages') return txt(`Page is type "${page.type}", not "packages".`);
    const pl = (page.payload ?? {}) as Record<string, unknown>;
    return json({
      id: page.id, title: page.title, enabled: page.enabled, position: page.position,
      introText: pl.intro_text || null,
      packages: pl.packages || [],
      footerText: pl.footer_text || null,
      styling: pl.styling || null,
    });
  });

  server.tool('set_package_tiers', 'Set the full package tiers array on a packages page. Replaces existing tiers. Works on proposal or template pages.', {
    proposalId: z.string().optional().describe('Proposal ID (provide proposalId OR templateId)'),
    templateId: z.string().optional().describe('Template ID (provide proposalId OR templateId)'),
    pageId: z.string(),
    packages: z.array(z.object({
      id: z.string().describe('Unique ID (e.g. "pkg_1"). Must be stable across updates'),
      name: z.string(),
      price: z.number(),
      price_prefix: z.string().optional().describe('Text above price (e.g. "FROM"). Default: empty'),
      price_suffix: z.string().optional().describe('Text after price (e.g. "/month"). Default: empty'),
      is_recommended: z.boolean().optional().describe('Highlight this tier as recommended'),
      highlight_color: z.string().optional().describe('Hex color override for recommended badge'),
      conditions: z.array(z.string()).optional().describe('Short condition lines shown below price'),
      features: z.array(z.object({
        text: z.string(),
        bold_prefix: z.string().optional().describe('Bold text before the feature text'),
        children: z.array(z.object({ text: z.string(), bold_prefix: z.string().optional() })).optional(),
      })),
      sort_order: z.number(),
    })),
    introText: z.string().optional(),
    footerText: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const ctx = resolvePageTable(args);
    if (ctx === 'ambiguous') return txt('Provide proposalId OR templateId, not both.');
    if (!ctx) return txt('Provide either proposalId or templateId.');
    const sb = createServiceClient();
    const { data: page } = await sb.from(ctx.table)
      .select('id, type, payload').eq('id', args.pageId).eq(ctx.fk, ctx.entityId).eq('company_id', auth.companyId).single();
    if (!page) return txt('Page not found');
    if (page.type !== 'packages') return txt(`Page is type "${page.type}", not "packages".`);
    const payload = { ...((page.payload ?? {}) as Record<string, unknown>) };
    payload.packages = args.packages.map(p => ({
      ...p, price_prefix: p.price_prefix ?? '', price_suffix: p.price_suffix ?? '',
      is_recommended: p.is_recommended ?? false, highlight_color: p.highlight_color ?? null,
      conditions: p.conditions ?? [], features: p.features || [],
    }));
    if (args.introText !== undefined) payload.intro_text = args.introText;
    if (args.footerText !== undefined) payload.footer_text = args.footerText;
    const { error } = await sb.from(ctx.table).update({ payload, updated_at: new Date().toISOString() }).eq('id', args.pageId).eq('company_id', auth.companyId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`${args.packages.length} package tier${args.packages.length !== 1 ? 's' : ''} saved.`);
  });
}
