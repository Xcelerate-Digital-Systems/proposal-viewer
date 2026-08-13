import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { addPage, updatePage, deletePage, reorderPages, getPageUrls } from '@/lib/page-operations';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import { checkResourceLimit } from '@/lib/billing/entitlements';
import { isValidWebhookUrl } from '@/lib/sanitize';
import type { PageType } from '@/lib/page-types';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerProposalTools(server: McpServer) {

  server.tool('list_proposals', 'List all proposals and quotes. Quotes have entity_type="pricing".', {
    status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'declined', 'revision_requested', 'all']).optional().describe('Filter by status. Default: all'),
    entityType: z.enum(['proposal', 'pricing', 'all']).optional().describe('Filter: proposal, pricing (quotes), or all. Default: all'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ status, entityType, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    let q = sb.from('proposals')
      .select('id, title, client_name, client_email, client_organisation, status, entity_type, quote_number, created_at, updated_at, sent_at, accepted_at, declined_at')
      .eq('company_id', auth.companyId).order('updated_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    if (entityType && entityType !== 'all') q = q.eq('entity_type', entityType);
    const { data, error } = await q;
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No proposals found.');
    return json(data.map(p => ({
      id: p.id, title: p.title, client: p.client_name, clientEmail: p.client_email, clientOrg: p.client_organisation,
      status: p.status, type: p.entity_type || 'proposal', quoteNumber: p.quote_number,
      sentAt: p.sent_at, acceptedAt: p.accepted_at, declinedAt: p.declined_at, updatedAt: p.updated_at,
    })));
  });

  server.tool('get_proposal', 'Get full proposal/quote detail including pricing and job info.', {
    proposalId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ proposalId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals')
      .select('id, title, client_name, client_email, client_organisation, description, status, entity_type, quote_number, currency, include_gst, gst_rate, require_deposit, deposit_percent, valid_until, site_address, estimated_start_date, estimated_duration, scope_of_works, category, revision_notes, decline_reason, created_by_name, prepared_by, share_token, created_at, updated_at, sent_at, accepted_at, declined_at, revision_requested_at')
      .eq('id', proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');
    const { data: packages } = await sb.from('proposal_packages').select('*').eq('proposal_id', proposalId).order('sort_order', { ascending: true });
    const { data: pricing } = await sb.from('proposal_pricing').select('*').eq('proposal_id', proposalId).order('sort_order', { ascending: true });
    return json({
      ...p, type: p.entity_type || 'proposal',
      packages: packages?.map(pkg => ({ id: pkg.id, name: pkg.name, description: pkg.description, price: pkg.price, isSelected: pkg.is_selected, sortOrder: pkg.sort_order })) || [],
      lineItems: pricing?.map(li => ({ id: li.id, packageId: li.package_id, name: li.name, description: li.description, quantity: li.quantity, unitPrice: li.unit_price, total: li.total, sortOrder: li.sort_order })) || [],
    });
  });

  server.tool('get_proposal_pages', 'Get the pages/sections of a proposal or document.', {
    proposalId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ proposalId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: pages, error } = await sb.from('proposal_pages_v2')
      .select('id, position, type, title, indent, enabled, link_url, link_label, orientation, show_title, payload')
      .eq('proposal_id', proposalId).eq('company_id', auth.companyId).order('position', { ascending: true });
    if (error) return txt(`Error: ${error.message}`);
    if (!pages?.length) return txt('No pages found.');
    return json(pages.map(p => ({
      id: p.id, position: p.position, type: p.type, title: p.title, indent: p.indent, enabled: p.enabled,
      linkUrl: p.link_url, orientation: p.orientation, showTitle: p.show_title,
      hasContent: !!(p.payload && typeof p.payload === 'object' && Object.keys(p.payload as object).length > 0),
      content: p.type === 'text' && p.payload ? (p.payload as Record<string, unknown>).html || (p.payload as Record<string, unknown>).content : undefined,
    })));
  });

  server.tool('update_proposal_status', 'Move a proposal or quote through the pipeline. Agency-side: draft↔sent. Use "draft" to pull back a sent proposal for edits.', {
    proposalId: z.string(),
    status: z.enum(['draft', 'sent']).describe('"sent" marks it as sent to the client. "draft" pulls it back for editing.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ proposalId, status, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id, status, entity_type').eq('id', proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');
    const label = p.entity_type === 'pricing' ? 'Quote' : 'Proposal';
    if (p.status === status) return txt(`${label} is already "${status}".`);
    if (status === 'sent' && p.status !== 'draft') return txt(`Can only mark as sent from draft. Current status: "${p.status}".`);
    if (status === 'draft' && !['sent', 'viewed'].includes(p.status)) return txt(`Can only pull back to draft from sent/viewed. Current status: "${p.status}".`);
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'sent') updates.sent_at = new Date().toISOString();
    const { error } = await sb.from('proposals').update(updates).eq('id', proposalId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`${label} status updated: ${p.status} → ${status}`);
  });

  server.tool('create_proposal', 'Create a new proposal or quote. Returns the new proposal ID. For quotes, pass entityType="pricing".', {
    title: z.string().describe('Proposal/quote title'),
    clientName: z.string().describe('Client name'),
    clientEmail: z.string().optional(),
    description: z.string().optional(),
    entityType: z.enum(['proposal', 'pricing']).optional().describe('"proposal" (default) or "pricing" for quotes'),
    createdByName: z.string().optional().describe('Name of the person creating this'),
    preparedBy: z.string().optional(),
    skipDefaultPages: z.boolean().optional().describe('If true, creates no pages. Default: false (creates an Introduction page for proposals, or Pricing+Packages+T&C for quotes)'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const companyId = auth.companyId;
    const isQuote = args.entityType === 'pricing';

    const limitCheck = await checkResourceLimit(companyId, 'proposals');
    if (!limitCheck.allowed) return txt(`Plan limit reached: ${limitCheck.reason || 'proposals'}`);

    const brandingDefaults = await getCompanyEntityDefaults(sb, companyId, {});

    let quoteNumber: number | null = null;
    if (isQuote) {
      const { data: counter } = await sb.rpc('claim_next_quote_number', { p_company_id: companyId });
      if (typeof counter === 'number') quoteNumber = counter;
    }

    const { data: proposal, error } = await sb.from('proposals').insert({
      title: args.title,
      client_name: args.clientName,
      client_email: args.clientEmail || null,
      description: args.description || null,
      file_path: '',
      file_size_bytes: 0,
      status: 'draft',
      page_names: [],
      company_id: companyId,
      created_by_name: args.createdByName || auth.memberName,
      prepared_by: args.preparedBy || args.createdByName || auth.memberName,
      entity_type: isQuote ? 'quote' : 'proposal',
      quote_number: quoteNumber,
      ...brandingDefaults,
    }).select('id').single();

    if (error || !proposal) return txt(`Failed: ${error?.message || 'unknown'}`);

    const pid = proposal.id;
    let pageCount = 0;

    if (!args.skipDefaultPages) {
      if (isQuote) {
        await addPage(sb, 'proposal', { entityId: pid, companyId, type: 'pricing', title: 'Pricing', position: 0 });
        await addPage(sb, 'proposal', { entityId: pid, companyId, type: 'packages', title: 'Packages', position: 1 });
        await addPage(sb, 'proposal', { entityId: pid, companyId, type: 'text', title: 'Terms & Conditions', position: 2 });
        pageCount = 3;
      } else {
        await addPage(sb, 'proposal', { entityId: pid, companyId, type: 'text', title: 'Introduction', position: 0 });
        pageCount = 1;
      }
    }

    return json({ id: pid, type: isQuote ? 'quote' : 'proposal', quoteNumber, pageCount, status: 'draft' });
  });

  server.tool('create_proposal_from_template', 'Create a new proposal pre-populated with pages from a template. Returns the new proposal ID.', {
    templateId: z.string().describe('Template to copy pages from'),
    title: z.string().describe('Proposal title'),
    clientName: z.string().describe('Client name'),
    clientEmail: z.string().optional(),
    description: z.string().optional(),
    createdByName: z.string().optional(),
    preparedBy: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const companyId = auth.companyId;

    const { data: tmpl } = await sb.from('proposal_templates').select('id, entity_type').eq('id', args.templateId).eq('company_id', companyId).single();
    if (!tmpl) return txt('Template not found');

    const limitCheck = await checkResourceLimit(companyId, 'proposals');
    if (!limitCheck.allowed) return txt(`Plan limit reached: ${limitCheck.reason || 'proposals'}`);

    const brandingDefaults = await getCompanyEntityDefaults(sb, companyId, {});

    const isQuote = tmpl.entity_type === 'quote';
    let quoteNumber: number | null = null;
    if (isQuote) {
      const { data: counter } = await sb.rpc('claim_next_quote_number', { p_company_id: companyId });
      if (typeof counter === 'number') quoteNumber = counter;
    }

    const { data: proposal, error } = await sb.from('proposals').insert({
      title: args.title,
      client_name: args.clientName,
      client_email: args.clientEmail || null,
      description: args.description || null,
      file_path: '',
      file_size_bytes: 0,
      status: 'draft',
      page_names: [],
      company_id: companyId,
      created_by_name: args.createdByName || auth.memberName,
      prepared_by: args.preparedBy || args.createdByName || auth.memberName,
      entity_type: isQuote ? 'quote' : 'proposal',
      quote_number: quoteNumber,
      ...brandingDefaults,
    }).select('id').single();

    if (error || !proposal) return txt(`Failed to create proposal: ${error?.message || 'unknown'}`);

    const pid = proposal.id;

    // Copy template pages into the new proposal
    const { data: templatePages } = await sb.from('template_pages_v2')
      .select('*').eq('template_id', args.templateId).order('position', { ascending: true });

    let copied = 0;
    if (templatePages?.length) {
      const toInsert = templatePages.map(tp => ({
        proposal_id: pid,
        company_id: companyId,
        position: tp.position,
        type: tp.type,
        title: tp.title,
        indent: tp.indent ?? 0,
        enabled: tp.enabled ?? true,
        link_url: tp.link_url ?? null,
        link_label: tp.link_label ?? null,
        orientation: tp.orientation ?? 'auto',
        show_title: tp.show_title ?? true,
        show_member_badge: tp.show_member_badge ?? false,
        show_client_logo: tp.show_client_logo ?? false,
        payload: tp.payload ?? {},
      }));

      const { data: inserted, error: insertErr } = await sb.from('proposal_pages_v2').insert(toInsert).select('id');
      if (insertErr) return txt(`Proposal created (${pid}) but page copy failed: ${insertErr.message}`);
      copied = inserted?.length || 0;
    }

    return json({ id: pid, type: isQuote ? 'quote' : 'proposal', quoteNumber, pagesCopied: copied, status: 'draft' });
  });

  server.tool('update_proposal', 'Update top-level fields on a proposal or quote (title, client info, description, branding, etc.). Cannot change status — use update_proposal_status for that.', {
    proposalId: z.string(),
    title: z.string().optional(),
    clientName: z.string().optional(),
    clientEmail: z.string().optional(),
    clientOrganisation: z.string().optional(),
    description: z.string().optional(),
    preparedBy: z.string().optional(),
    currency: z.string().optional(),
    includeGst: z.boolean().optional(),
    gstRate: z.number().optional(),
    requireDeposit: z.boolean().optional(),
    depositPercent: z.number().optional(),
    validUntil: z.string().optional().describe('ISO date string'),
    siteAddress: z.string().optional(),
    estimatedStartDate: z.string().optional(),
    estimatedDuration: z.string().optional(),
    scopeOfWorks: z.string().optional(),
    category: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const MAP: [string, string][] = [
      ['title', 'title'], ['clientName', 'client_name'], ['clientEmail', 'client_email'],
      ['clientOrganisation', 'client_organisation'], ['description', 'description'],
      ['preparedBy', 'prepared_by'], ['currency', 'currency'], ['includeGst', 'include_gst'],
      ['gstRate', 'gst_rate'], ['requireDeposit', 'require_deposit'], ['depositPercent', 'deposit_percent'],
      ['validUntil', 'valid_until'], ['siteAddress', 'site_address'],
      ['estimatedStartDate', 'estimated_start_date'], ['estimatedDuration', 'estimated_duration'],
      ['scopeOfWorks', 'scope_of_works'], ['category', 'category'],
    ];
    let fieldCount = 0;
    for (const [param, col] of MAP) {
      const val = (args as Record<string, unknown>)[param];
      if (val !== undefined) { updates[col] = val; fieldCount++; }
    }
    if (fieldCount === 0) return txt('No fields to update — pass at least one field.');

    const { error } = await sb.from('proposals').update(updates).eq('id', args.proposalId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Proposal updated (${fieldCount} field${fieldCount > 1 ? 's' : ''}).`);
  });

  server.tool('add_proposal_page', 'Add a new page to a proposal. Returns the new page ID. For PDF pages, provide a filePath (Supabase storage path in the "proposals" bucket). For html pages, provide content — rendered raw in a sandboxed iframe (no scripts).', {
    proposalId: z.string(),
    type: z.enum(['text', 'pdf', 'html', 'pricing', 'packages', 'toc', 'section']).describe('Page type'),
    title: z.string().optional().describe('Page title (auto-generated if omitted)'),
    position: z.number().optional().describe('Insert at this position (0-based). Omit to append at the end.'),
    content: z.string().optional().describe('HTML content for text pages (TipTap-converted) or html pages (rendered raw in a sandboxed iframe)'),
    filePath: z.string().optional().describe('Supabase storage path for PDF pages (e.g. "proposals/{id}/page-3.pdf")'),
    indent: z.number().optional().describe('Indentation level (0-3). Default: 0'),
    enabled: z.boolean().optional().describe('Whether page is visible. Default: true'),
    showTitle: z.boolean().optional().describe('Show title on page. Default: true'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    if (args.type === 'pdf' && !args.filePath) return txt('filePath is required for PDF pages.');
    if (args.type === 'html' && !args.content) return txt('content is required for html pages.');

    const payload: Record<string, unknown> = {};
    if (args.content && (args.type === 'text' || args.type === 'html')) {
      payload.html = args.content;
    }
    if (args.filePath && args.type === 'pdf') {
      // Only files under this proposal's own folder — a foreign path would
      // point the page at (and on replace, delete) another tenant's object.
      if (args.filePath.includes('..') || !args.filePath.startsWith(`proposals/${args.proposalId}/`)) {
        return txt(`filePath must start with "proposals/${args.proposalId}/" — upload via upload_proposal_file first.`);
      }
      payload.file_path = args.filePath;
    }

    const result = await addPage(sb, 'proposal', {
      entityId: args.proposalId,
      companyId: auth.companyId,
      type: args.type as PageType,
      title: args.title,
      position: args.position,
      payload: Object.keys(payload).length ? payload : undefined,
      indent: args.indent,
      showTitle: args.showTitle,
    });

    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return json({ id: result.page.id, position: result.page.position, type: result.page.type, title: result.page.title });
  });

  server.tool('upload_proposal_file', 'Upload a file to the proposals storage bucket, either from a public URL or as base64 content (max ~3MB base64 — MCP request bodies are size-limited). Returns the filePath to use with add_proposal_page or update_proposal_page. Supports PDF, PNG, JPG, SVG, WEBP.', {
    proposalId: z.string().describe('Proposal ID — used to namespace the storage path'),
    url: z.string().optional().describe('Public URL to fetch the file from (provide url OR base64, not both)'),
    base64: z.string().optional().describe('Base64-encoded file content (no data: prefix). Requires contentType. Max ~3MB decoded.'),
    contentType: z.string().optional().describe('MIME type for base64 uploads (application/pdf, image/png, image/jpeg, image/svg+xml, image/webp)'),
    fileName: z.string().optional().describe('Override filename (e.g. "slide-1.pdf"). Auto-detected from URL if omitted.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    const ALLOWED_TYPES: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/svg+xml': '.svg',
      'image/webp': '.webp',
    };

    // Content must look like what it claims to be, whichever way it arrived.
    // SVG has no magic bytes; require it to parse as markup-ish text.
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
      try {
        buf = Buffer.from(args.base64, 'base64');
      } catch {
        return txt('Invalid base64 content.');
      }
      if (buf.byteLength === 0) return txt('Decoded file is empty.');
      // MCP requests arrive as JSON on a serverless function; the platform
      // body limit is the real ceiling, so cap well under it.
      if (buf.byteLength > 3 * 1024 * 1024) return txt('base64 file too large (max 3MB decoded). Use the url input for larger files.');
    } else {
      let parsed: URL;
      try {
        parsed = new URL(args.url as string);
      } catch {
        return txt('Invalid URL.');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return txt('Only http(s) URLs are supported.');
      }
      if (!isValidWebhookUrl(parsed.toString())) {
        return txt('URL not allowed: private/internal addresses are blocked.');
      }
      let res: Response;
      try {
        res = await fetch(args.url as string, { redirect: 'follow' });
      } catch (e) {
        return txt(`Failed to fetch URL: ${e instanceof Error ? e.message : 'network error'}`);
      }
      if (!res.ok) return txt(`URL returned ${res.status} ${res.statusText}`);

      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      mimeBase = contentType.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES[mimeBase]) return txt(`Unsupported content type: ${mimeBase}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);

      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) return txt('Downloaded file is empty.');
      if (bytes.byteLength > 50 * 1024 * 1024) return txt('File too large (max 50MB).');
      buf = Buffer.from(bytes);
    }

    if (!matchesMagicBytes(buf, mimeBase)) {
      return txt(`File content does not match declared type ${mimeBase}.`);
    }

    const sanitizedId = args.proposalId.replace(/[^a-zA-Z0-9._-]/g, '');
    let name = args.fileName;
    if (!name && args.url) {
      try {
        const urlPath = new URL(args.url).pathname;
        name = urlPath.split('/').pop() || undefined;
      } catch { /* fall through */ }
    }
    if (!name) name = `file-${Date.now()}${ALLOWED_TYPES[mimeBase]}`;
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `proposals/${sanitizedId}/${safeName}`;

    const { error: uploadErr } = await sb.storage.from('proposals').upload(filePath, buf, {
      contentType: mimeBase,
      upsert: true,
    });

    if (uploadErr) return txt(`Upload failed: ${uploadErr.message}`);

    return json({ filePath, contentType: mimeBase, sizeBytes: buf.byteLength });
  });

  server.tool('update_proposal_page', 'Update a page\'s title, content, file, or display settings. For PDF pages, pass filePath to replace the file.', {
    proposalId: z.string(),
    pageId: z.string(),
    title: z.string().optional(),
    content: z.string().optional().describe('HTML content (text pages only). Merges into payload.html'),
    filePath: z.string().optional().describe('New Supabase storage path for PDF pages — replaces the existing file'),
    enabled: z.boolean().optional(),
    indent: z.number().optional(),
    showTitle: z.boolean().optional(),
    orientation: z.enum(['auto', 'portrait', 'landscape']).optional(),
    linkUrl: z.string().optional().describe('External link URL'),
    linkLabel: z.string().optional().describe('External link label'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    const changes: Record<string, unknown> = {};
    if (args.title !== undefined) changes.title = args.title;
    if (args.enabled !== undefined) changes.enabled = args.enabled;
    if (args.indent !== undefined) changes.indent = args.indent;
    if (args.showTitle !== undefined) changes.show_title = args.showTitle;
    if (args.orientation !== undefined) changes.orientation = args.orientation;
    if (args.linkUrl !== undefined) changes.link_url = args.linkUrl;
    if (args.linkLabel !== undefined) changes.link_label = args.linkLabel;
    if (args.content !== undefined) {
      changes.payload_patch = { html: args.content };
    }
    if (args.filePath !== undefined) {
      // Same guard as add_proposal_page: no cross-tenant path references.
      if (args.filePath.includes('..') || !args.filePath.startsWith(`proposals/${args.proposalId}/`)) {
        return txt(`filePath must start with "proposals/${args.proposalId}/" — upload via upload_proposal_file first.`);
      }
      changes.payload_patch = { ...(changes.payload_patch as Record<string, unknown> || {}), file_path: args.filePath };
    }

    if (Object.keys(changes).length === 0) return txt('No fields to update.');

    const result = await updatePage(sb, 'proposal', args.pageId, changes, { entityId: args.proposalId });
    if (result.error || !result.page) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page "${result.page.title}" updated.`);
  });

  server.tool('delete_proposal_page', 'Delete a page from a proposal. Cannot delete the last remaining page.', {
    proposalId: z.string(),
    pageId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    const result = await deletePage(sb, 'proposal', { entityId: args.proposalId, pageId: args.pageId });
    if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Page deleted. ${result.totalPages} page${result.totalPages !== 1 ? 's' : ''} remaining.`);
  });

  server.tool('reorder_proposal_pages', 'Reorder pages by providing the full ordered list of page IDs.', {
    proposalId: z.string(),
    orderedPageIds: z.array(z.string()).describe('Page IDs in the desired order. Must include all page IDs.'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');

    const result = await reorderPages(sb, 'proposal', { entityId: args.proposalId, orderedIds: args.orderedPageIds });
    if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
    return txt(`Pages reordered (${args.orderedPageIds.length} pages).`);
  });

  server.tool('get_proposal_page_urls', 'Get signed download URLs for all pages in a proposal (needed to view PDF pages).', {
    proposalId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ proposalId, companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');
    const result = await getPageUrls(sb, 'proposal', { entityId: proposalId });
    if (result.error) return txt(`Error: ${result.error}`);
    return json(result.pages);
  });

  server.tool('duplicate_proposal', 'Duplicate a proposal or quote, including all pages. Returns the new ID.', {
    proposalId: z.string(),
    newTitle: z.string().optional().describe('Title for the duplicate. Default: "Copy of {original title}"'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: src } = await sb.from('proposals').select('*').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!src) return txt('Proposal not found');
    const source = src as Record<string, unknown>;
    const OMIT = new Set(['id', 'share_token', 'status', 'sent_at', 'first_viewed_at', 'last_viewed_at',
      'view_count', 'accepted_at', 'accepted_by_name', 'declined_at', 'declined_by_name',
      'decline_reason', 'revision_requested_at', 'created_at', 'updated_at', 'quote_number']);
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) { if (!OMIT.has(k)) row[k] = v; }
    row.title = args.newTitle || `Copy of ${source.title}`;
    row.status = 'draft';
    if (source.entity_type === 'quote') {
      const { data: qn } = await sb.rpc('claim_next_quote_number', { p_company_id: auth.companyId });
      if (qn) row.quote_number = qn;
    }
    const { data: newProp, error } = await sb.from('proposals').insert(row).select('id, title, entity_type, quote_number').single();
    if (error || !newProp) return txt(`Failed: ${error?.message || 'unknown'}`);
    const { data: pages } = await sb.from('proposal_pages_v2').select('*').eq('proposal_id', args.proposalId).order('position');
    let pagesCopied = 0;
    if (pages?.length) {
      const newPages = pages.map(p => {
        const pg = p as Record<string, unknown>;
        const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = pg;
        return { ...rest, proposal_id: (newProp as Record<string, unknown>).id };
      });
      const { error: pErr } = await sb.from('proposal_pages_v2').insert(newPages);
      if (!pErr) pagesCopied = newPages.length;
    }
    const np = newProp as Record<string, unknown>;
    return json({ id: np.id, title: np.title, type: np.entity_type, quoteNumber: np.quote_number, pagesCopied, status: 'draft' });
  });

  server.tool('save_proposal_as_template', 'Save a proposal as a reusable template. Copies all branding and pages.', {
    proposalId: z.string(),
    name: z.string().optional().describe('Template name. Default: proposal title'),
    description: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: src } = await sb.from('proposals').select('*').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!src) return txt('Proposal not found');
    const source = src as Record<string, unknown>;
    const COPY_COLUMNS = [
      'entity_type', 'file_path',
      'cover_image_path', 'cover_enabled', 'cover_subtitle', 'cover_button_text',
      'cover_bg_style', 'cover_bg_color_1', 'cover_bg_color_2',
      'cover_gradient_type', 'cover_gradient_angle', 'cover_gradient_position_x', 'cover_gradient_position_y',
      'cover_gradient_stops', 'cover_overlay_opacity', 'cover_text_color', 'cover_subtitle_color',
      'cover_button_bg', 'cover_button_text_color', 'cover_client_logo_path', 'cover_client_logo_tint_color',
      'cover_avatar_path', 'cover_date', 'cover_show_client_logo', 'cover_show_avatar',
      'cover_show_date', 'cover_show_prepared_by', 'prepared_by', 'prepared_by_member_id',
      'bg_image_path', 'bg_image_overlay_opacity', 'bg_image_blur',
      'page_orientation', 'toc_settings', 'page_order',
      'text_page_bg_color', 'text_page_text_color', 'text_page_heading_color',
      'text_page_font_size', 'text_page_border_enabled', 'text_page_border_color',
      'text_page_border_radius', 'text_page_layout',
      'title_font_family', 'title_font_weight', 'title_font_size', 'title_font_transform',
      'font_heading_family', 'font_heading_weight', 'font_heading_size', 'font_heading_transform',
      'font_body_family', 'font_body_weight', 'font_body_transform',
      'font_button_family', 'font_button_weight',
      'page_num_circle_color', 'page_num_text_color',
      'quote_page_bg_color', 'quote_header_bg_color_1', 'quote_header_bg_color_2',
      'quote_header_text_color', 'quote_header_subtitle_color',
      'post_accept_action', 'post_accept_redirect_url', 'post_accept_message', 'package_styling',
      'decision_action_bg_color', 'decision_action_text_color', 'decision_action_heading_color',
      'decision_action_accent_color', 'decision_decline_button_color', 'decision_revision_button_color',
      'decision_checkbox_color', 'decision_page_enabled', 'decision_page_title', 'decision_extras',
      'pricing_header_text_color', 'pricing_text_color', 'pricing_price_title_color', 'pricing_price_color',
      'pricing_payment_schedule_name_color', 'pricing_payment_schedule_price_color',
      'pricing_accent_bar_color', 'pricing_dot_color',
    ];
    const tmplRow: Record<string, unknown> = {
      name: args.name || source.title, description: args.description || source.description || null,
      company_id: auth.companyId,
    };
    for (const col of COPY_COLUMNS) { if (source[col] !== undefined) tmplRow[col] = source[col]; }
    const { data: tmpl, error } = await sb.from('proposal_templates').insert(tmplRow).select('id, name').single();
    if (error || !tmpl) return txt(`Failed: ${error?.message || 'unknown'}`);
    const { data: pages } = await sb.from('proposal_pages_v2').select('*').eq('proposal_id', args.proposalId).order('position');
    let pagesCopied = 0;
    if (pages?.length) {
      const newPages = pages.map(p => {
        const pg = p as Record<string, unknown>;
        const { id: _id, created_at: _ca, updated_at: _ua, proposal_id: _pid, ...rest } = pg;
        return { ...rest, template_id: (tmpl as Record<string, unknown>).id };
      });
      const { error: pErr } = await sb.from('template_pages_v2').insert(newPages);
      if (!pErr) pagesCopied = newPages.length;
    }
    const t = tmpl as Record<string, unknown>;
    return json({ id: t.id, name: t.name, pagesCopied });
  });

}
