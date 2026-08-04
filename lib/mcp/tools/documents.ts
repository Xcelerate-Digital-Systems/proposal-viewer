import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { addPage, updatePage, deletePage } from '@/lib/page-operations';
import { checkResourceLimit } from '@/lib/billing/entitlements';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import type { PageType } from '@/lib/page-types';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerDocumentTools(server: McpServer) {
  server.tool('list_documents', 'List all documents in the workspace.', {}, async (_args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('documents')
      .select('id, title, description, created_at, updated_at')
      .eq('company_id', auth.companyId).order('updated_at', { ascending: false });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No documents found.');
    return json(data);
  });

  server.tool('get_document', 'Get document detail and its pages.', {
    documentId: z.string(),
  }, async ({ documentId }, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: doc } = await sb.from('documents')
      .select('id, title, description, page_names, created_at, updated_at')
      .eq('id', documentId).eq('company_id', auth.companyId).single();
    if (!doc) return txt('Document not found');
    const { data: pages } = await sb.from('document_pages_v2')
      .select('id, position, type, title, indent, enabled, payload')
      .eq('document_id', documentId).eq('company_id', auth.companyId).order('position', { ascending: true });
    return json({
      ...doc,
      pages: (pages || []).map(p => ({
        id: p.id, position: p.position, type: p.type, title: p.title, indent: p.indent, enabled: p.enabled,
        content: p.type === 'text' && p.payload ? (p.payload as Record<string, unknown>).html || (p.payload as Record<string, unknown>).content : undefined,
      })),
    });
  });

  server.tool('create_document', 'Create a new document. Returns the document ID.', {
    title: z.string(),
    description: z.string().optional(),
  }, async (args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const limitCheck = await checkResourceLimit(auth.companyId, 'documents');
    if (!limitCheck.allowed) return txt(`Plan limit reached: ${limitCheck.reason || 'documents'}`);
    const brandingDefaults = await getCompanyEntityDefaults(sb, auth.companyId, {});
    const { data, error } = await sb.from('documents').insert({
      title: args.title, description: args.description || null,
      file_path: '', file_size_bytes: 0, page_names: [],
      company_id: auth.companyId, ...brandingDefaults,
    }).select('id').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    await addPage(sb, 'document', { entityId: data.id, companyId: auth.companyId, type: 'text', title: 'Introduction', position: 0 });
    return json({ id: data.id, pageCount: 1 });
  });

  server.tool('update_document', 'Update document title or description.', {
    documentId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
  }, async (args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: d } = await sb.from('documents').select('id').eq('id', args.documentId).eq('company_id', auth.companyId).single();
    if (!d) return txt('Document not found');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (Object.keys(updates).length <= 1) return txt('No fields to update.');
    const { error } = await sb.from('documents').update(updates).eq('id', args.documentId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Document updated.');
  });

  server.tool('delete_document', 'Delete a document and all its pages.', {
    documentId: z.string(),
  }, async ({ documentId }, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: d } = await sb.from('documents').select('id, title').eq('id', documentId).eq('company_id', auth.companyId).single();
    if (!d) return txt('Document not found');
    await sb.from('document_pages_v2').delete().eq('document_id', documentId);
    const { error } = await sb.from('documents').delete().eq('id', documentId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Document "${d.title}" deleted.`);
  });

  server.tool('add_document_page', 'Add a page to a document.', {
    documentId: z.string(),
    type: z.enum(['text', 'pdf', 'toc', 'section']).describe('Page type'),
    title: z.string().optional(),
    position: z.number().optional(),
    content: z.string().optional().describe('HTML content for text pages'),
    filePath: z.string().optional().describe('Storage path for PDF pages'),
  }, async (args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: d } = await sb.from('documents').select('id').eq('id', args.documentId).eq('company_id', auth.companyId).single();
    if (!d) return txt('Document not found');
    if (args.type === 'pdf' && !args.filePath) return txt('filePath is required for PDF pages.');
    const payload: Record<string, unknown> = {};
    if (args.content && args.type === 'text') payload.html = args.content;
    if (args.filePath && args.type === 'pdf') payload.file_path = args.filePath;
    const result = await addPage(sb, 'document', { entityId: args.documentId, companyId: auth.companyId, type: args.type as PageType, title: args.title, position: args.position, payload: Object.keys(payload).length ? payload : undefined });
    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return json({ id: result.page.id, position: result.page.position, type: result.page.type, title: result.page.title });
  });

  server.tool('update_document_page', 'Update a document page.', {
    documentId: z.string(), pageId: z.string(),
    title: z.string().optional(), content: z.string().optional(),
    filePath: z.string().optional(), enabled: z.boolean().optional(),
    indent: z.number().optional(), showTitle: z.boolean().optional(),
  }, async (args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: d } = await sb.from('documents').select('id').eq('id', args.documentId).eq('company_id', auth.companyId).single();
    if (!d) return txt('Document not found');
    const changes: Record<string, unknown> = {};
    if (args.title !== undefined) changes.title = args.title;
    if (args.enabled !== undefined) changes.enabled = args.enabled;
    if (args.indent !== undefined) changes.indent = args.indent;
    if (args.showTitle !== undefined) changes.show_title = args.showTitle;
    if (args.content !== undefined) changes.payload_patch = { html: args.content };
    if (args.filePath !== undefined) changes.payload_patch = { ...(changes.payload_patch as Record<string, unknown> || {}), file_path: args.filePath };
    if (Object.keys(changes).length === 0) return txt('No fields to update.');
    const result = await updatePage(sb, 'document', args.pageId, changes, { entityId: args.documentId });
    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page "${result.page.title}" updated.`);
  });

  server.tool('delete_document_page', 'Delete a page from a document.', {
    documentId: z.string(), pageId: z.string(),
  }, async (args, extra) => {
    const auth = getAuth(extra); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: d } = await sb.from('documents').select('id').eq('id', args.documentId).eq('company_id', auth.companyId).single();
    if (!d) return txt('Document not found');
    const result = await deletePage(sb, 'document', { entityId: args.documentId, pageId: args.pageId });
    if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page deleted. ${result.totalPages} remaining.`);
  });
}
