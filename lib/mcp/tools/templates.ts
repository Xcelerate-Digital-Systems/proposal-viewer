import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { addPage, updatePage, deletePage, reorderPages, getPageUrls } from '@/lib/page-operations';
import { isValidWebhookUrl } from '@/lib/sanitize';
import { checkResourceLimit } from '@/lib/billing/entitlements';
import type { PageType } from '@/lib/page-types';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';

export function registerTemplateTools(server: McpServer) {
  server.tool('list_templates', 'List all templates in the template library.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('proposal_templates')
      .select('id, name, description, entity_type, created_at, updated_at')
      .eq('company_id', auth.companyId).order('updated_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No templates found.');
    return json(data.map(t => ({ id: t.id, name: t.name, description: t.description, type: t.entity_type || 'proposal', updatedAt: t.updated_at })));
  });

  server.tool('get_template', 'Get template detail and its pages.', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ templateId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates')
      .select('id, name, description, entity_type, section_headers, created_at, updated_at')
      .eq('id', templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const { data: pages } = await sb.from('template_pages_v2')
      .select('id, position, type, title, indent, enabled, payload')
      .eq('template_id', templateId).eq('company_id', auth.companyId).order('position', { ascending: true });
    return json({
      id: t.id, name: t.name, description: t.description, type: t.entity_type || 'proposal', sectionHeaders: t.section_headers,
      pages: (pages || []).map(p => ({
        id: p.id, position: p.position, type: p.type, title: p.title, indent: p.indent, enabled: p.enabled,
        content: p.type === 'text' && p.payload ? (p.payload as Record<string, unknown>).html || (p.payload as Record<string, unknown>).content : undefined,
      })),
      updatedAt: t.updated_at,
    });
  });

  server.tool('create_template', 'Create a new template in the template library.', {
    name: z.string(),
    description: z.string().optional(),
    entityType: z.enum(['proposal', 'quote']).optional().describe('Default: proposal'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const brandingDefaults = await getCompanyEntityDefaults(sb, auth.companyId, {});
    const { data, error } = await sb.from('proposal_templates').insert({
      name: args.name, description: args.description || null,
      entity_type: args.entityType || 'proposal',
      company_id: auth.companyId, ...brandingDefaults,
    }).select('id').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    await addPage(sb, 'template', { entityId: data.id, companyId: auth.companyId, type: 'text', title: 'Introduction', position: 0 });
    return json({ id: data.id, pageCount: 1 });
  });

  server.tool('update_template', 'Update template name, description, or section headers.', {
    templateId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (Object.keys(updates).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('proposal_templates').update(updates).eq('id', args.templateId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Template updated.');
  });

  server.tool('delete_template', 'Delete a template and all its pages.', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ templateId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id, name').eq('id', templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    await sb.from('template_pages_v2').delete().eq('template_id', templateId);
    const { error } = await sb.from('proposal_templates').delete().eq('id', templateId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Template "${t.name}" deleted.`);
  });

  server.tool('upload_template_file', 'Upload a file to the templates storage bucket, either from a public URL or as base64 content (max ~3MB base64). Returns the filePath to use with add_template_page or update_template_page. Supports PDF, PNG, JPG, SVG, WEBP.', {
    templateId: z.string().describe('Template ID — used to namespace the storage path'),
    url: z.string().optional().describe('Public URL to fetch the file from (provide url OR base64, not both)'),
    base64: z.string().optional().describe('Base64-encoded file content (no data: prefix). Requires contentType. Max ~3MB decoded.'),
    contentType: z.string().optional().describe('MIME type for base64 uploads (application/pdf, image/png, image/jpeg, image/svg+xml, image/webp)'),
    fileName: z.string().optional().describe('Override filename (e.g. "slide-1.pdf"). Auto-detected from URL if omitted.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');

    const ALLOWED_TYPES: Record<string, string> = {
      'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg',
      'image/svg+xml': '.svg', 'image/webp': '.webp',
    };

    const matchesMagicBytes = (buf: Buffer, mime: string): boolean => {
      switch (mime) {
        case 'application/pdf': return buf.subarray(0, 5).toString('latin1') === '%PDF-';
        case 'image/png':       return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        case 'image/jpeg':      return buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
        case 'image/webp':      return buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
        case 'image/svg+xml':   return buf.subarray(0, 512).toString('utf8').trimStart().startsWith('<');
        default: return false;
      }
    };

    if (!args.url && !args.base64) return txt('Provide either url or base64.');
    if (args.url && args.base64) return txt('Provide url OR base64, not both.');

    let buf: Buffer;
    let mimeBase: string;

    if (args.base64) {
      mimeBase = (args.contentType || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES[mimeBase]) return txt(`base64 uploads require contentType. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);
      try { buf = Buffer.from(args.base64, 'base64'); } catch { return txt('Invalid base64 content.'); }
      if (buf.byteLength === 0) return txt('Decoded file is empty.');
      if (buf.byteLength > 3 * 1024 * 1024) return txt('base64 file too large (max 3MB decoded). Use the url input for larger files.');
    } else {
      let parsed: URL;
      try { parsed = new URL(args.url as string); } catch { return txt('Invalid URL.'); }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return txt('Only http(s) URLs are supported.');
      if (!isValidWebhookUrl(parsed.toString())) return txt('URL not allowed: private/internal addresses are blocked.');
      let res: Response;
      try { res = await fetch(args.url as string, { redirect: 'follow' }); } catch (e) { return txt(`Failed to fetch URL: ${e instanceof Error ? e.message : 'network error'}`); }
      if (!res.ok) return txt(`URL returned ${res.status} ${res.statusText}`);
      if (res.url && res.url !== args.url && !isValidWebhookUrl(res.url)) return txt('URL redirected to a private/internal address — blocked.');
      const ct = res.headers.get('content-type') || 'application/octet-stream';
      mimeBase = ct.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES[mimeBase]) return txt(`Unsupported content type: ${mimeBase}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) return txt('Downloaded file is empty.');
      if (bytes.byteLength > 50 * 1024 * 1024) return txt('File too large (max 50MB).');
      buf = Buffer.from(bytes);
    }

    if (!matchesMagicBytes(buf, mimeBase)) return txt(`File content does not match declared type ${mimeBase}.`);

    const sanitizedId = args.templateId.replace(/[^a-zA-Z0-9._-]/g, '');
    let name = args.fileName;
    if (!name && args.url) {
      try { name = new URL(args.url).pathname.split('/').pop() || undefined; } catch { /* fall through */ }
    }
    if (!name) name = `file-${Date.now()}${ALLOWED_TYPES[mimeBase]}`;
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `templates/${sanitizedId}/${safeName}`;

    const { error: uploadErr } = await sb.storage.from('proposals').upload(filePath, buf, {
      contentType: mimeBase, upsert: true,
    });
    if (uploadErr) return txt(`Upload failed: ${uploadErr.message}`);

    return json({ filePath, contentType: mimeBase, sizeBytes: buf.byteLength });
  });

  server.tool('add_template_page', 'Add a page to a template.', {
    templateId: z.string(),
    type: z.enum(['text', 'pdf', 'pricing', 'packages', 'toc', 'section', 'html']).describe('Page type'),
    title: z.string().optional(),
    position: z.number().optional(),
    content: z.string().optional().describe('HTML content for text pages'),
    filePath: z.string().optional().describe('Storage path for PDF pages'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    if (args.type === 'pdf' && !args.filePath) return txt('filePath is required for PDF pages.');
    const payload: Record<string, unknown> = {};
    if (args.content && (args.type === 'text' || args.type === 'html')) payload.html = args.content;
    if (args.filePath && args.type === 'pdf') {
      if (args.filePath.includes('..') || !args.filePath.startsWith(`templates/${args.templateId}/`)) {
        return txt(`filePath must start with "templates/${args.templateId}/" — upload via upload_template_file first.`);
      }
      payload.file_path = args.filePath;
    }
    const result = await addPage(sb, 'template', { entityId: args.templateId, companyId: auth.companyId, type: args.type as PageType, title: args.title, position: args.position, payload: Object.keys(payload).length ? payload : undefined });
    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return json({ id: result.page.id, position: result.page.position, type: result.page.type, title: result.page.title });
  });

  server.tool('update_template_page', 'Update a template page.', {
    templateId: z.string(), pageId: z.string(),
    title: z.string().optional(), content: z.string().optional(),
    filePath: z.string().optional(), enabled: z.boolean().optional(),
    indent: z.number().optional(), showTitle: z.boolean().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const changes: Record<string, unknown> = {};
    if (args.title !== undefined) changes.title = args.title;
    if (args.enabled !== undefined) changes.enabled = args.enabled;
    if (args.indent !== undefined) changes.indent = args.indent;
    if (args.showTitle !== undefined) changes.show_title = args.showTitle;
    if (args.content !== undefined) changes.payload_patch = { html: args.content };
    if (args.filePath !== undefined) {
      if (args.filePath.includes('..') || !args.filePath.startsWith(`templates/${args.templateId}/`)) {
        return txt(`filePath must start with "templates/${args.templateId}/" — upload via upload_template_file first.`);
      }
      changes.payload_patch = { ...(changes.payload_patch as Record<string, unknown> || {}), file_path: args.filePath };
    }
    if (Object.keys(changes).length === 0) return txt('No fields to update.');
    const result = await updatePage(sb, 'template', args.pageId, changes, { entityId: args.templateId });
    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page "${result.page.title}" updated.`);
  });

  server.tool('delete_template_page', 'Delete a page from a template.', {
    templateId: z.string(), pageId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const result = await deletePage(sb, 'template', { entityId: args.templateId, pageId: args.pageId });
    if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page deleted. ${result.totalPages} remaining.`);
  });

  server.tool('reorder_template_pages', 'Reorder pages by providing the full ordered list of page IDs.', {
    templateId: z.string(),
    orderedPageIds: z.array(z.string()).describe('Page IDs in the desired order. Must include all page IDs.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const result = await reorderPages(sb, 'template', { entityId: args.templateId, orderedIds: args.orderedPageIds });
    if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Pages reordered (${args.orderedPageIds.length} pages).`);
  });

  server.tool('get_template_page_urls', 'Get signed download URLs for all pages in a template (needed to view PDF pages).', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ templateId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const result = await getPageUrls(sb, 'template', { entityId: templateId });
    if (result.error) return txt(`Error: ${result.error}`);
    return json(result.pages);
  });

  server.tool('duplicate_template', 'Duplicate a template, including all pages. Returns the new template ID.', {
    templateId: z.string(),
    newName: z.string().optional().describe('Name for the duplicate. Default: "Copy of {original name}"'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: src } = await sb.from('proposal_templates').select('*').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!src) return txt('Template not found');
    const source = src as Record<string, unknown>;
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = source;
    const row = { ...rest, name: args.newName || `Copy of ${source.name}` };
    const { data: newTmpl, error } = await sb.from('proposal_templates').insert(row).select('id, name').single();
    if (error || !newTmpl) return txt(`Failed: ${error?.message || 'unknown'}`);
    const { data: pages } = await sb.from('template_pages_v2').select('*').eq('template_id', args.templateId).eq('company_id', auth.companyId).order('position');
    let pagesCopied = 0;
    if (pages?.length) {
      const newPages = pages.map(p => {
        const pg = p as Record<string, unknown>;
        const { id: _pid, created_at: _pca, updated_at: _pua, ...pRest } = pg;
        return { ...pRest, template_id: (newTmpl as Record<string, unknown>).id, company_id: auth.companyId };
      });
      const { error: pErr } = await sb.from('template_pages_v2').insert(newPages);
      if (!pErr) pagesCopied = newPages.length;
    }
    const nt = newTmpl as Record<string, unknown>;
    return json({ id: nt.id, name: nt.name, pagesCopied });
  });
}
