import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { addPage } from '@/lib/page-operations';
import type { PageType } from '@/lib/page-types';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerLibraryTools(server: McpServer) {

  // ── Page Library ─────────────────────────────────────────────────────────

  server.tool('list_page_library', 'List all saved pages in the page library.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('page_library')
      .select('id, type, title, label, indent, enabled, position, orientation, show_title, created_at')
      .eq('company_id', auth.companyId).order('created_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No saved pages in library.');
    return json(data);
  });

  server.tool('save_to_page_library', 'Save a page from a proposal/template/document into the page library.', {
    sourcePageId: z.string(),
    sourceEntityType: z.enum(['proposal', 'document', 'template']),
    label: z.string().optional().describe('Custom label for the saved page'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const tableMap = { proposal: 'proposal_pages_v2', document: 'document_pages_v2', template: 'template_pages_v2' } as const;
    const table = tableMap[args.sourceEntityType];
    const { data: src } = await sb.from(table).select('*').eq('id', args.sourcePageId).eq('company_id', auth.companyId).single();
    if (!src) return txt('Source page not found');
    const row = src as Record<string, unknown>;
    const { data, error } = await sb.from('page_library').insert({
      company_id: auth.companyId,
      type: row.type, title: row.title, label: args.label || row.title,
      indent: row.indent ?? 0, enabled: true, position: 0,
      link_url: row.link_url ?? null, link_label: row.link_label ?? null,
      orientation: row.orientation ?? null, show_title: row.show_title ?? true,
      show_member_badge: row.show_member_badge ?? false,
      show_client_logo: row.show_client_logo ?? false,
      prepared_by_member_id: row.prepared_by_member_id ?? null,
      payload: row.payload ?? null,
    }).select('id, title, label').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json(data);
  });

  server.tool('delete_page_library_item', 'Delete a page from the page library.', {
    pageId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ pageId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('page_library').select('id').eq('id', pageId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Library page not found');
    const { error } = await sb.from('page_library').delete().eq('id', pageId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Library page deleted.');
  });

  server.tool('import_library_page', 'Import a library page into a proposal, template, or document.', {
    libraryPageId: z.string(),
    targetEntityType: z.enum(['proposal', 'document', 'template']),
    targetEntityId: z.string(),
    position: z.number().optional().describe('Position to insert at (0-based). Appended if omitted.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: lib } = await sb.from('page_library').select('*').eq('id', args.libraryPageId).eq('company_id', auth.companyId).single();
    if (!lib) return txt('Library page not found');
    const row = lib as Record<string, unknown>;
    const entityTableMap = { proposal: 'proposals', document: 'documents', template: 'proposal_templates' } as const;
    const entityTable = entityTableMap[args.targetEntityType];
    const { data: entity } = await sb.from(entityTable).select('id').eq('id', args.targetEntityId).eq('company_id', auth.companyId).single();
    if (!entity) return txt(`${args.targetEntityType} not found`);
    const result = await addPage(sb, args.targetEntityType, {
      entityId: args.targetEntityId, companyId: auth.companyId,
      type: row.type as PageType, title: (row.title as string) || 'Imported page',
      position: args.position, payload: (row.payload as Record<string, unknown>) ?? undefined,
      indent: (row.indent as number) ?? 0, showTitle: (row.show_title as boolean) ?? true,
    });
    if (!result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return json({ id: result.page.id, title: result.page.title, position: result.page.position });
  });

  // ── Line Item Templates ──────────────────────────────────────────────────

  server.tool('list_line_item_templates', 'List all saved pricing line item presets.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('line_item_templates')
      .select('id, name, description, items, created_at')
      .eq('company_id', auth.companyId).order('created_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No line item templates found.');
    return json(data);
  });

  server.tool('create_line_item_template', 'Save a set of pricing line items as a reusable template.', {
    name: z.string(),
    description: z.string().optional(),
    items: z.array(z.object({
      label: z.string(), description: z.string().optional(),
      amount: z.number(), qty: z.number().optional(), unit_price: z.number().optional(),
    })),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('line_item_templates').insert({
      name: args.name, description: args.description || null,
      items: args.items, company_id: auth.companyId, created_by: auth.userId,
    }).select('id, name').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json(data);
  });

  server.tool('delete_line_item_template', 'Delete a line item template.', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ templateId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('line_item_templates').select('id').eq('id', templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const { error } = await sb.from('line_item_templates').delete().eq('id', templateId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Line item template deleted.');
  });

  // ── Package Templates ────────────────────────────────────────────────────

  server.tool('list_package_templates', 'List all saved package tier presets.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('package_templates')
      .select('id, name, description, tier, created_at')
      .eq('company_id', auth.companyId).order('created_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No package templates found.');
    return json(data);
  });

  server.tool('create_package_template', 'Save a package tier as a reusable template.', {
    name: z.string(),
    description: z.string().optional(),
    tier: z.object({
      name: z.string(), price: z.number(),
      features: z.array(z.object({ text: z.string() })),
    }),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('package_templates').insert({
      name: args.name, description: args.description || null,
      tier: args.tier, company_id: auth.companyId, created_by: auth.userId,
    }).select('id, name').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json(data);
  });

  server.tool('delete_package_template', 'Delete a package template.', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ templateId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('package_templates').select('id').eq('id', templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const { error } = await sb.from('package_templates').delete().eq('id', templateId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Package template deleted.');
  });
}
