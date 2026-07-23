import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { hashApiKey, API_KEY_PREFIX } from '@/lib/api-auth';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

type McpAuthInfo = AuthInfo & {
  companyId: string;
  userId: string;
  memberId: string;
  memberName: string;
  role: string;
};

function getAuth(extra: { authInfo?: AuthInfo }): McpAuthInfo | null {
  if (!extra.authInfo) return null;
  return extra.authInfo as McpAuthInfo;
}

function unauthorized() {
  return { content: [{ type: 'text' as const, text: 'Unauthorized — provide a valid Bearer token (av_live_*)' }] };
}

function txt(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function json(data: unknown) {
  return txt(JSON.stringify(data, null, 2));
}

const mcpHandler = createMcpHandler(
  (server) => {

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  GUIDE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('get_guide', 'Returns a guide on how to use the AgencyViz MCP tools. Call this first.', {}, async () => txt(
`# AgencyViz MCP — Tool Guide

## Sections & Tools

### Campaigns (Feedback/Markup)
- \`list_campaigns\` → \`get_campaign\` → \`list_assets\` → \`get_asset_detail\`
- \`get_comments\` / \`get_unresolved\` — read feedback
- \`resolve_comment\`, \`add_comment\`, \`update_asset_status\` — write ops

### Pitch (Proposals + Quotes + Documents)
- \`list_proposals\` → \`get_proposal\` → \`get_proposal_pages\`
- \`list_documents\` → \`get_document\`
- Quotes are proposals with entity_type='pricing'

### Template Library
- \`list_templates\` → \`get_template\`

### Swipe Vault
- \`list_swipe_collections\` → \`list_swipe_files\` → \`get_swipe_file\`

### Funnel Planner
- \`list_funnels\` → \`get_funnel\`

### Workspace
- \`get_company\` — company info and branding
- \`list_team_members\` — team roster
- \`list_clients\` — client companies

## Key concepts
- Proposals flow: draft → sent → viewed → accepted/declined/revision_requested
- Campaign assets flow: draft → internal_review → client_review → approved/revision_needed/rejected
- Comments have pin coordinates (pin_x, pin_y as %) showing where feedback was placed
- Everything is scoped to your company — you only see your workspace's data`));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  CAMPAIGNS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_campaigns', 'List all campaigns (review projects).', {
      status: z.enum(['active', 'archived', 'all']).optional().describe('Filter by status. Default: active'),
    }, async ({ status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('review_projects')
        .select('id, title, client_name, client_company, status, created_at, updated_at')
        .eq('company_id', auth.companyId).order('updated_at', { ascending: false });
      const f = status || 'active';
      if (f === 'active') q = q.eq('status', 'active');
      else if (f === 'archived') q = q.eq('status', 'archived');
      const { data, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No campaigns found.');
      return json(data.map(p => ({ id: p.id, title: p.title, client: p.client_company || p.client_name, status: p.status, updatedAt: p.updated_at })));
    });

    server.tool('get_campaign', 'Get campaign detail with asset counts by type and status.', {
      campaignId: z.string().describe('Campaign ID'),
    }, async ({ campaignId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: p } = await sb.from('review_projects').select('*').eq('id', campaignId).eq('company_id', auth.companyId).single();
      if (!p) return txt('Campaign not found');
      const { data: items } = await sb.from('review_items').select('id, type, status').eq('review_project_id', campaignId).eq('company_id', auth.companyId);
      const tc: Record<string, number> = {}, sc: Record<string, number> = {};
      for (const i of items || []) { tc[i.type] = (tc[i.type] || 0) + 1; sc[i.status] = (sc[i.status] || 0) + 1; }
      return json({ id: p.id, title: p.title, client: p.client_company || p.client_name, status: p.status, assetCount: items?.length || 0, assetsByType: tc, assetsByStatus: sc, createdAt: p.created_at, updatedAt: p.updated_at });
    });

    server.tool('list_assets', 'List assets in a campaign with comment counts.', {
      campaignId: z.string(), type: z.string().optional(), status: z.string().optional(),
    }, async ({ campaignId, type, status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('review_items')
        .select('id, title, type, status, version, url, figma_frame_name, updated_at')
        .eq('review_project_id', campaignId).eq('company_id', auth.companyId).order('sort_order', { ascending: true });
      if (type) q = q.eq('type', type);
      if (status) q = q.eq('status', status);
      const { data: items, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      const { data: comments } = await sb.from('review_comments').select('id, review_item_id, parent_comment_id, resolved').eq('review_project_id', campaignId).eq('company_id', auth.companyId);
      const cc: Record<string, { total: number; unresolved: number }> = {};
      for (const c of comments || []) {
        if (c.parent_comment_id || !c.review_item_id) continue;
        if (!cc[c.review_item_id]) cc[c.review_item_id] = { total: 0, unresolved: 0 };
        cc[c.review_item_id].total++; if (!c.resolved) cc[c.review_item_id].unresolved++;
      }
      return json((items || []).map(i => ({ id: i.id, title: i.title, type: i.type, status: i.status, version: i.version, url: i.url, figmaFrame: i.figma_frame_name, comments: cc[i.id] || { total: 0, unresolved: 0 }, updatedAt: i.updated_at })));
    });

    server.tool('get_asset_detail', 'Get full asset detail including versions and Figma metadata.', {
      assetId: z.string(),
    }, async ({ assetId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('*').eq('id', assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const { data: versions } = await sb.from('review_item_versions').select('id, version_number, notes, image_url, url, figma_frame_name, created_at').eq('review_item_id', assetId).order('version_number', { ascending: true });
      return json({
        id: item.id, title: item.title, type: item.type, status: item.status, version: item.version, url: item.url, imageUrl: item.image_url,
        figma: item.figma_file_key ? { fileKey: item.figma_file_key, nodeId: item.figma_node_id, fileName: item.figma_file_name, frameName: item.figma_frame_name } : null,
        versions: (versions || []).map(v => ({ id: v.id, number: v.version_number, notes: v.notes, imageUrl: v.image_url, url: v.url, createdAt: v.created_at })),
        createdAt: item.created_at, updatedAt: item.updated_at,
      });
    });

    server.tool('get_comments', 'Get all comments on an asset, organized as threads.', {
      assetId: z.string(), unresolvedOnly: z.boolean().optional(),
    }, async ({ assetId, unresolvedOnly }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('review_comments')
        .select('id, content, author_name, pin_x, pin_y, resolved, priority, parent_comment_id, thread_number, created_at')
        .eq('review_item_id', assetId).eq('company_id', auth.companyId).order('created_at', { ascending: true });
      if (unresolvedOnly) q = q.eq('resolved', false);
      const { data: comments, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      const threads: Record<string, Record<string, unknown>> = {};
      const replies: Record<string, unknown[]> = {};
      for (const c of comments || []) {
        if (c.parent_comment_id) {
          if (!replies[c.parent_comment_id]) replies[c.parent_comment_id] = [];
          replies[c.parent_comment_id].push({ id: c.id, content: c.content, author: c.author_name, createdAt: c.created_at });
        } else {
          threads[c.id] = { id: c.id, threadNumber: c.thread_number, content: c.content, author: c.author_name, pinX: c.pin_x, pinY: c.pin_y, resolved: c.resolved, priority: c.priority, createdAt: c.created_at, replies: [] };
        }
      }
      for (const [pid, reps] of Object.entries(replies)) { if (threads[pid]) threads[pid].replies = reps; }
      return json(Object.values(threads));
    });

    server.tool('get_unresolved', 'Get all unresolved comments across a campaign, grouped by asset.', {
      campaignId: z.string(),
    }, async ({ campaignId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: comments } = await sb.from('review_comments')
        .select('id, content, author_name, pin_x, pin_y, priority, thread_number, review_item_id, created_at')
        .eq('review_project_id', campaignId).eq('company_id', auth.companyId).eq('resolved', false).is('parent_comment_id', null).order('created_at', { ascending: true });
      if (!comments?.length) return txt('No unresolved comments in this campaign.');
      const itemIds = Array.from(new Set(comments.map(c => c.review_item_id).filter(Boolean)));
      const { data: items } = await sb.from('review_items').select('id, title, type, status').in('id', itemIds);
      const im: Record<string, { title: string; type: string; status: string }> = {};
      for (const i of items || []) im[i.id] = { title: i.title, type: i.type, status: i.status };
      const grouped: Record<string, { asset: unknown; comments: unknown[] }> = {};
      for (const c of comments) {
        const iid = c.review_item_id || 'unknown';
        if (!grouped[iid]) grouped[iid] = { asset: im[iid] || { title: 'Unknown' }, comments: [] };
        grouped[iid].comments.push({ id: c.id, threadNumber: c.thread_number, content: c.content, author: c.author_name, pinX: c.pin_x, pinY: c.pin_y, priority: c.priority, createdAt: c.created_at });
      }
      return json(Object.entries(grouped).map(([assetId, g]) => ({ assetId, ...g })));
    });

    server.tool('resolve_comment', 'Mark a comment as resolved.', {
      commentId: z.string(),
    }, async ({ commentId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { error } = await sb.from('review_comments').update({ resolved: true, resolved_by: auth.memberId, resolved_at: new Date().toISOString() }).eq('id', commentId).eq('company_id', auth.companyId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Comment ${commentId} resolved.`);
    });

    server.tool('add_comment', 'Add a comment to an asset. Can be a thread reply.', {
      assetId: z.string(), content: z.string(), parentCommentId: z.string().optional(),
    }, async ({ assetId, content, parentCommentId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('id, review_project_id').eq('id', assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      let threadNumber: number | null = null;
      if (!parentCommentId) {
        const { count } = await sb.from('review_comments').select('id', { count: 'exact', head: true }).eq('review_item_id', assetId).is('parent_comment_id', null);
        threadNumber = (count || 0) + 1;
      }
      const { data: comment, error } = await sb.from('review_comments').insert({
        review_project_id: item.review_project_id, review_item_id: assetId, company_id: auth.companyId,
        content, author_name: auth.memberName, author_user_id: auth.userId,
        parent_comment_id: parentCommentId || null, thread_number: threadNumber, source: 'mcp',
      }).select('id, thread_number').single();
      if (error || !comment) return txt(`Failed: ${error?.message || 'unknown'}`);
      return txt(`Comment added (ID: ${comment.id}${comment.thread_number ? `, thread #${comment.thread_number}` : ''}).`);
    });

    server.tool('update_asset_status', 'Move an asset between workflow stages.', {
      assetId: z.string(),
      status: z.enum(['draft', 'internal_review', 'client_review', 'approved', 'revision_needed', 'rejected', 'archived']),
    }, async ({ assetId, status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('id, status').eq('id', assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const { error } = await sb.from('review_items').update({ status, prior_status: item.status, updated_at: new Date().toISOString() }).eq('id', assetId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Asset status updated: ${item.status} → ${status}`);
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  PROPOSALS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_proposals', 'List all proposals and quotes. Quotes have entity_type="pricing".', {
      status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'declined', 'revision_requested', 'all']).optional().describe('Filter by status. Default: all'),
      entityType: z.enum(['proposal', 'pricing', 'all']).optional().describe('Filter: proposal, pricing (quotes), or all. Default: all'),
    }, async ({ status, entityType }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ proposalId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ proposalId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  DOCUMENTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      const { data: pages } = await sb.from('proposal_pages_v2')
        .select('id, position, type, title, indent, enabled, payload')
        .eq('proposal_id', documentId).eq('company_id', auth.companyId).order('position', { ascending: true });
      return json({
        ...doc,
        pages: (pages || []).map(p => ({
          id: p.id, position: p.position, type: p.type, title: p.title, indent: p.indent, enabled: p.enabled,
          content: p.type === 'text' && p.payload ? (p.payload as Record<string, unknown>).html || (p.payload as Record<string, unknown>).content : undefined,
        })),
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  TEMPLATES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_templates', 'List all templates in the template library.', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ templateId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: t } = await sb.from('proposal_templates')
        .select('id, name, description, entity_type, section_headers, created_at, updated_at')
        .eq('id', templateId).eq('company_id', auth.companyId).single();
      if (!t) return txt('Template not found');
      const { data: pages } = await sb.from('proposal_pages_v2')
        .select('id, position, type, title, indent, enabled, payload')
        .eq('proposal_id', templateId).eq('company_id', auth.companyId).order('position', { ascending: true });
      return json({
        id: t.id, name: t.name, description: t.description, type: t.entity_type || 'proposal', sectionHeaders: t.section_headers,
        pages: (pages || []).map(p => ({
          id: p.id, position: p.position, type: p.type, title: p.title, indent: p.indent, enabled: p.enabled,
          content: p.type === 'text' && p.payload ? (p.payload as Record<string, unknown>).html || (p.payload as Record<string, unknown>).content : undefined,
        })),
        updatedAt: t.updated_at,
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  SWIPE VAULT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_swipe_collections', 'List all swipe vault collections (naming conventions).', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data, error } = await sb.from('swipe_types')
        .select('id, name, description, sort_order, created_at')
        .eq('company_id', auth.companyId).order('sort_order', { ascending: true });
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No swipe collections found.');
      return json(data);
    });

    server.tool('list_swipe_files', 'List swipe files, optionally filtered by collection.', {
      collectionId: z.string().optional().describe('Filter by swipe type/collection ID'),
      mediaType: z.enum(['image', 'video', 'all']).optional(),
    }, async ({ collectionId, mediaType }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('swipe_files')
        .select('id, title, headline, primary_text, description, cta, media_type, media_url, thumbnail_url, source_url, brand, notes, tags, type_id, transcription, created_at, updated_at')
        .eq('company_id', auth.companyId).order('sort_order', { ascending: true });
      if (collectionId) q = q.eq('type_id', collectionId);
      if (mediaType && mediaType !== 'all') q = q.eq('media_type', mediaType);
      const { data, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No swipe files found.');
      return json(data.map(f => ({
        id: f.id, title: f.title, headline: f.headline, primaryText: f.primary_text, description: f.description,
        cta: f.cta, mediaType: f.media_type, mediaUrl: f.media_url, thumbnailUrl: f.thumbnail_url,
        sourceUrl: f.source_url, brand: f.brand, notes: f.notes, tags: f.tags, collectionId: f.type_id,
        transcription: f.transcription, updatedAt: f.updated_at,
      })));
    });

    server.tool('get_swipe_file', 'Get full detail of a single swipe file.', {
      swipeFileId: z.string(),
    }, async ({ swipeFileId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: f } = await sb.from('swipe_files').select('*').eq('id', swipeFileId).eq('company_id', auth.companyId).single();
      if (!f) return txt('Swipe file not found');
      return json({
        id: f.id, title: f.title, headline: f.headline, primaryText: f.primary_text, description: f.description,
        cta: f.cta, mediaType: f.media_type, mediaUrl: f.media_url, thumbnailUrl: f.thumbnail_url,
        sourceUrl: f.source_url, brand: f.brand, notes: f.notes, tags: f.tags, collectionId: f.type_id,
        transcription: f.transcription, aiPrompt: f.ai_prompt, createdAt: f.created_at, updatedAt: f.updated_at,
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  FUNNELS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_funnels', 'List all funnels in the workspace.', {
      status: z.enum(['draft', 'active', 'archived', 'all']).optional(),
    }, async ({ status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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

    server.tool('get_funnel', 'Get funnel detail with all steps and their metrics.', {
      funnelId: z.string(),
    }, async ({ funnelId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: funnel } = await sb.from('funnels').select('*').eq('id', funnelId).eq('company_id', auth.companyId).single();
      if (!funnel) return txt('Funnel not found');
      const { data: steps } = await sb.from('funnel_steps')
        .select('id, step_type, label, icon, url, color, board_x, board_y, metrics, created_at')
        .eq('funnel_id', funnelId).eq('company_id', auth.companyId);
      return json({
        id: funnel.id, name: funnel.name, description: funnel.description, status: funnel.status,
        currency: funnel.currency, forecastPeriod: funnel.forecast_period, defaultDealValue: funnel.default_deal_value,
        isTemplate: funnel.is_template, createdAt: funnel.created_at, updatedAt: funnel.updated_at,
        steps: (steps || []).map(s => ({
          id: s.id, type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
          position: { x: s.board_x, y: s.board_y }, metrics: s.metrics,
        })),
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  WORKSPACE (Company, Team, Clients)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('get_company', 'Get company profile, branding, and settings.', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: c } = await sb.from('companies')
        .select('id, name, slug, website, phone, contact_email, abn, address, accent_color, font_heading, font_body, custom_domain, domain_verified, account_type, brand_colors, created_at')
        .eq('id', auth.companyId).single();
      if (!c) return txt('Company not found');
      return json(c);
    });

    server.tool('list_team_members', 'List all team members in the workspace.', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data, error } = await sb.from('team_members')
        .select('id, name, email, role, created_at')
        .eq('company_id', auth.companyId).order('created_at', { ascending: true });
      if (error) return txt(`Error: ${error.message}`);
      return json((data || []).map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role, joinedAt: m.created_at })));
    });

    server.tool('list_clients', 'List client companies linked to this agency.', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data, error } = await sb.from('companies')
        .select('id, name, slug, website, contact_email, phone, created_at')
        .eq('agency_id', auth.companyId).eq('account_type', 'client').order('name', { ascending: true });
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No client companies found.');
      return json(data);
    });
  },
  {
    capabilities: { tools: {} },
    serverInfo: { name: 'agencyviz', version: '1.0.0' },
  },
  {
    basePath: '/api/mcp',
    streamableHttpEndpoint: '/api/mcp',
    sseEndpoint: '/api/mcp/sse',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== 'production',
  },
);

async function verifyToken(_req: Request, bearerToken?: string): Promise<McpAuthInfo | undefined> {
  if (!bearerToken || !bearerToken.startsWith(API_KEY_PREFIX)) return undefined;
  const sb = createServiceClient();
  const keyHash = hashApiKey(bearerToken);
  const { data: key } = await sb.from('api_keys').select('id, company_id, user_id, revoked_at').eq('key_hash', keyHash).single();
  if (!key || key.revoked_at) return undefined;
  const { data: member } = await sb.from('team_members').select('id, name, email, role').eq('user_id', key.user_id).eq('company_id', key.company_id).single();
  if (!member) return undefined;
  sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {});
  return {
    token: bearerToken, clientId: 'mcp', scopes: ['campaigns:read', 'campaigns:write'],
    companyId: key.company_id, userId: key.user_id, memberId: member.id,
    memberName: member.name || member.email || 'Unknown', role: member.role,
  };
}

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
