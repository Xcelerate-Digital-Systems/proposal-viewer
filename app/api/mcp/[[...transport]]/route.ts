import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { hashApiKey, API_KEY_PREFIX } from '@/lib/api-auth';
import { addPage, updatePage, deletePage, reorderPages } from '@/lib/page-operations';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import { checkResourceLimit } from '@/lib/billing/entitlements';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { PageType } from '@/lib/page-types';

type McpAuthInfo = AuthInfo & {
  companyId: string;
  userId: string;
  memberId: string;
  memberName: string;
  role: string;
  isSuperAdmin: boolean;
};

function getAuth(extra: { authInfo?: AuthInfo }, companyIdOverride?: string): McpAuthInfo | null {
  if (!extra.authInfo) return null;
  const auth = extra.authInfo as McpAuthInfo;
  if (companyIdOverride && companyIdOverride !== auth.companyId) {
    if (!auth.isSuperAdmin) return null;
    return { ...auth, companyId: companyIdOverride };
  }
  return auth;
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
- \`create_asset\` — add a new asset to a campaign (any content type)
- \`create_asset_version\` — upload a new revision of an existing asset (optionally reset stage)
- \`update_asset_content\` — edit content fields in-place without creating a new version
- \`get_comments\` / \`get_unresolved\` — read feedback
- \`resolve_comment\`, \`add_comment\` — comment write ops
- \`update_asset_status\` — move a single asset between stages
- \`bulk_update_asset_status\` — move all (or filtered) assets in a campaign
- \`update_campaign_status\` — archive or activate a campaign project

### Pitch (Proposals + Quotes + Documents)
- \`list_proposals\` → \`get_proposal\` → \`get_proposal_pages\`
- \`create_proposal\` — create a new blank proposal or quote
- \`create_proposal_from_template\` — create a proposal pre-populated with template pages
- \`update_proposal\` — edit title, client info, description, branding fields
- \`update_proposal_status\` — mark as sent or pull back to draft
- \`upload_proposal_file\` — upload a file from a URL to the proposals storage bucket (returns filePath for PDF pages)
- \`add_proposal_page\` — add a text/pdf/pricing/packages/toc/section page
- \`update_proposal_page\` — edit a page's title, content, or settings
- \`delete_proposal_page\` — remove a page
- \`reorder_proposal_pages\` — reorder pages by ID array
- \`list_documents\` → \`get_document\`
- Quotes are proposals with entity_type='pricing'

### Template Library
- \`list_templates\` → \`get_template\`

### Swipe Vault
- \`list_swipe_collections\` → \`list_swipe_files\` → \`get_swipe_file\`

### Funnel Planner
- \`list_funnels\` → \`get_funnel\` (includes steps, edges, and shapes)
- \`create_funnel\` — create a new empty funnel
- \`update_funnel\` — edit name, description, status, currency, forecast settings
- \`delete_funnel\` — delete a funnel and all its children
- \`create_funnel_step\` — add a node (traffic source, page, offer, or generic)
- \`update_funnel_step\` — edit label, position, metrics, icon, color
- \`delete_funnel_step\` — remove a node and its connected edges
- \`create_funnel_edge\` — connect two nodes with a labeled edge
- \`update_funnel_edge\` — edit label, handles, animation, split percent
- \`delete_funnel_edge\` — remove a connection

### Workspace
- \`get_company\` — company info and branding
- \`list_team_members\` — team roster
- \`list_clients\` — client companies

## Key concepts
- Proposals flow: draft → sent → viewed → accepted/declined/revision_requested
- Campaign assets flow: draft → internal_review → client_review → approved/revision_needed/rejected
- Comments have pin coordinates (pin_x, pin_y as %) showing where feedback was placed
- Everything is scoped to your company — you only see your workspace's data
- **Super admins**: pass \`companyId\` on any campaign/asset tool to operate on a different company. Use \`list_companies\` to discover accessible companies.`));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  CAMPAIGNS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_campaigns', 'List all campaigns (review projects).', {
      status: z.enum(['active', 'archived', 'all']).optional().describe('Filter by status. Default: active'),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ status, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, type, status, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('review_items')
        .select('id, title, type, status, version, url, figma_frame_name, updated_at')
        .eq('review_project_id', campaignId).eq('company_id', auth.companyId).order('sort_order', { ascending: true });
      if (type) q = q.eq('type', type);
      if (status) q = q.eq('status', status);
      const { data: items, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      const itemIds = (items || []).map(i => i.id);
      const cc: Record<string, { total: number; unresolved: number }> = {};
      if (itemIds.length) {
        const { data: comments } = await sb.from('review_comments').select('id, review_item_id, parent_comment_id, resolved').in('review_item_id', itemIds).eq('company_id', auth.companyId);
        for (const c of comments || []) {
          if (c.parent_comment_id || !c.review_item_id) continue;
          if (!cc[c.review_item_id]) cc[c.review_item_id] = { total: 0, unresolved: 0 };
          cc[c.review_item_id].total++; if (!c.resolved) cc[c.review_item_id].unresolved++;
        }
      }
      return json((items || []).map(i => ({ id: i.id, title: i.title, type: i.type, status: i.status, version: i.version, url: i.url, figmaFrame: i.figma_frame_name, comments: cc[i.id] || { total: 0, unresolved: 0 }, updatedAt: i.updated_at })));
    });

    server.tool('get_asset_detail', 'Get full asset detail including versions and Figma metadata.', {
      assetId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ assetId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('*').eq('id', assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const { data: versionRows } = await sb.from('review_item_versions').select('id, version_number, notes, image_url, url, figma_frame_name, created_at').eq('review_item_id', assetId).order('version_number', { ascending: true });
      const v1 = { id: item.id, number: 1, notes: null as string | null, imageUrl: item.image_url, url: item.url, createdAt: item.created_at };
      const laterVersions = (versionRows || []).map(v => ({ id: v.id, number: v.version_number, notes: v.notes, imageUrl: v.image_url, url: v.url, createdAt: v.created_at }));
      return json({
        id: item.id, title: item.title, type: item.type, status: item.status, version: item.version, url: item.url, imageUrl: item.image_url,
        figma: item.figma_file_key ? { fileKey: item.figma_file_key, nodeId: item.figma_node_id, fileName: item.figma_file_name, frameName: item.figma_frame_name } : null,
        versions: [v1, ...laterVersions],
        createdAt: item.created_at, updatedAt: item.updated_at,
      });
    });

    server.tool('get_comments', 'Get all comments on an asset, organized as threads. Includes attachments and screenshot URLs.', {
      assetId: z.string(), unresolvedOnly: z.boolean().optional(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ assetId, unresolvedOnly, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      let q = sb.from('review_comments')
        .select('id, content, author_name, pin_x, pin_y, viewport_width, pin_element_selector, pin_anchor_text, resolved, priority, parent_comment_id, thread_number, attachments, screenshot_url, video_url, comment_type, created_at')
        .eq('review_item_id', assetId).eq('company_id', auth.companyId).order('created_at', { ascending: true });
      if (unresolvedOnly) q = q.eq('resolved', false);
      const { data: comments, error } = await q;
      if (error) return txt(`Error: ${error.message}`);
      const fmtAttachments = (c: Record<string, unknown>) => {
        const out: { url: string; name?: string; type?: string }[] = [];
        if (c.screenshot_url) out.push({ url: c.screenshot_url as string, type: 'screenshot' });
        if (c.video_url) out.push({ url: c.video_url as string, type: 'video' });
        const atts = c.attachments as Array<{ url?: string; name?: string; type?: string }> | null;
        if (Array.isArray(atts)) for (const a of atts) { if (a.url) out.push({ url: a.url, name: a.name, type: a.type }); }
        return out.length ? out : undefined;
      };
      const threads: Record<string, Record<string, unknown>> = {};
      const replies: Record<string, unknown[]> = {};
      for (const c of comments || []) {
        if (c.parent_comment_id) {
          if (!replies[c.parent_comment_id]) replies[c.parent_comment_id] = [];
          replies[c.parent_comment_id].push({ id: c.id, content: c.content, author: c.author_name, attachments: fmtAttachments(c), createdAt: c.created_at });
        } else {
          threads[c.id] = { id: c.id, threadNumber: c.thread_number, content: c.content, author: c.author_name, type: c.comment_type, pinX: c.pin_x, pinY: c.pin_y, viewportWidth: c.viewport_width, elementSelector: c.pin_element_selector, anchorText: c.pin_anchor_text, resolved: c.resolved, priority: c.priority, attachments: fmtAttachments(c), createdAt: c.created_at, replies: [] };
        }
      }
      for (const [pid, reps] of Object.entries(replies)) { if (threads[pid]) threads[pid].replies = reps; }
      return json(Object.values(threads));
    });

    server.tool('get_unresolved', 'Get all unresolved comments across a campaign, grouped by asset. Includes attachments.', {
      campaignId: z.string(),
      since: z.string().optional().describe('ISO 8601 timestamp — only return comments created after this time'),
    }, async ({ campaignId, since }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: campaignItems } = await sb.from('review_items').select('id, title, type, status').eq('review_project_id', campaignId).eq('company_id', auth.companyId);
      if (!campaignItems?.length) return txt('No assets in this campaign.');
      const campaignItemIds = campaignItems.map(i => i.id);
      let q = sb.from('review_comments')
        .select('id, content, author_name, pin_x, pin_y, viewport_width, pin_element_selector, pin_anchor_text, priority, thread_number, review_item_id, attachments, screenshot_url, video_url, created_at')
        .in('review_item_id', campaignItemIds).eq('company_id', auth.companyId).eq('resolved', false).is('parent_comment_id', null).order('created_at', { ascending: true });
      if (since) q = q.gt('created_at', since);
      const { data: comments } = await q;
      if (!comments?.length) return txt(since ? 'No new unresolved comments since that time.' : 'No unresolved comments in this campaign.');
      const im: Record<string, { title: string; type: string; status: string }> = {};
      for (const i of campaignItems) im[i.id] = { title: i.title, type: i.type, status: i.status };
      const grouped: Record<string, { asset: unknown; comments: unknown[] }> = {};
      for (const c of comments) {
        const iid = c.review_item_id || 'unknown';
        if (!grouped[iid]) grouped[iid] = { asset: im[iid] || { title: 'Unknown' }, comments: [] };
        const atts: { url: string; name?: string; type?: string }[] = [];
        if (c.screenshot_url) atts.push({ url: c.screenshot_url, type: 'screenshot' });
        if (c.video_url) atts.push({ url: c.video_url, type: 'video' });
        const fileAtts = c.attachments as Array<{ url?: string; name?: string; type?: string }> | null;
        if (Array.isArray(fileAtts)) for (const a of fileAtts) { if (a.url) atts.push({ url: a.url, name: a.name, type: a.type }); }
        grouped[iid].comments.push({ id: c.id, threadNumber: c.thread_number, content: c.content, author: c.author_name, pinX: c.pin_x, pinY: c.pin_y, viewportWidth: c.viewport_width, elementSelector: c.pin_element_selector, anchorText: c.pin_anchor_text, priority: c.priority, attachments: atts.length ? atts : undefined, createdAt: c.created_at });
      }
      return json(Object.entries(grouped).map(([assetId, g]) => ({ assetId, ...g })));
    });

    server.tool('resolve_comment', 'Mark a comment as resolved, with an optional note.', {
      commentId: z.string(),
      note: z.string().optional().describe('Resolution note (e.g. "fixed in deploy abc123"). Added as a reply before resolving.'),
    }, async ({ commentId, note }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: comment } = await sb.from('review_comments').select('id, review_item_id, review_project_id, company_id').eq('id', commentId).eq('company_id', auth.companyId).single();
      if (!comment) return txt('Comment not found');
      if (note?.trim()) {
        await sb.from('review_comments').insert({
          review_item_id: comment.review_item_id, review_project_id: comment.review_project_id,
          company_id: comment.company_id, parent_comment_id: commentId,
          content: note.trim(), author_name: auth.memberName, author_user_id: auth.userId,
          author_type: 'team', comment_type: 'general', source: 'mcp',
        });
      }
      const { error } = await sb.from('review_comments').update({ resolved: true, resolved_by: auth.memberName, resolved_at: new Date().toISOString() }).eq('id', commentId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Comment ${commentId} resolved.${note?.trim() ? ' Note added as reply.' : ''}`);
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ assetId, status, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('id, status').eq('id', assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const { error } = await sb.from('review_items').update({ status, prior_status: item.status, updated_at: new Date().toISOString() }).eq('id', assetId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Asset status updated: ${item.status} → ${status}`);
    });

    server.tool('update_campaign_status', 'Archive or activate a campaign project.', {
      campaignId: z.string(),
      status: z.enum(['active', 'archived']),
    }, async ({ campaignId, status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: project } = await sb.from('review_projects').select('id, status').eq('id', campaignId).eq('company_id', auth.companyId).single();
      if (!project) return txt('Campaign not found');
      if (project.status === status) return txt(`Campaign is already ${status}.`);
      const { error } = await sb.from('review_projects').update({ status, updated_at: new Date().toISOString() }).eq('id', campaignId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Campaign status updated: ${project.status} → ${status}`);
    });

    server.tool('bulk_update_asset_status', 'Move all assets in a campaign (or filtered subset) to a new stage.', {
      campaignId: z.string(),
      status: z.enum(['draft', 'internal_review', 'client_review', 'approved', 'revision_needed', 'rejected', 'archived']),
      fromStatus: z.string().optional().describe('Only move assets currently in this stage'),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, status, fromStatus, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: project } = await sb.from('review_projects').select('id').eq('id', campaignId).eq('company_id', auth.companyId).single();
      if (!project) return txt('Campaign not found');
      let q = sb.from('review_items').select('id, status').eq('review_project_id', campaignId).eq('company_id', auth.companyId);
      if (fromStatus) q = q.eq('status', fromStatus);
      const { data: items } = await q;
      if (!items?.length) return txt('No matching assets found.');
      const toUpdate = items.filter(i => i.status !== status);
      if (!toUpdate.length) return txt(`All ${items.length} assets are already in "${status}".`);
      const { error } = await sb.from('review_items')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('review_project_id', campaignId).eq('company_id', auth.companyId)
        .in('id', toUpdate.map(i => i.id));
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`${toUpdate.length} asset(s) moved to "${status}".`);
    });

    server.tool('create_asset', 'Create a new asset in a campaign. Returns the new asset ID.', {
      campaignId: z.string().describe('Campaign (review_project) ID'),
      title: z.string(),
      type: z.enum(['webpage', 'email', 'ad', 'image', 'video', 'sms', 'google_search_ad', 'google_banner_ad', 'pdf', 'meta_lead_form', 'section']),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
      url: z.string().optional().describe('URL for webpage assets'),
      htmlContent: z.string().optional().describe('HTML body for webpage/email assets'),
      imageUrl: z.string().optional().describe('Image URL for image/ad assets'),
      videoUrl: z.string().optional().describe('Video URL for video assets'),
      pdfUrl: z.string().optional().describe('PDF URL for pdf assets'),
      adHeadline: z.string().optional().describe('Ad headline (Meta ad)'),
      adCopy: z.string().optional().describe('Ad primary text (Meta ad)'),
      adCta: z.string().optional().describe('Ad CTA button text'),
      adCreativeUrl: z.string().optional().describe('Ad creative image URL'),
      adPlatform: z.string().optional().describe('Ad platform (facebook_feed, instagram_feed, etc.)'),
      metaAdVariants: z.array(z.object({
        id: z.string(), label: z.string().optional(), primary_text: z.string(), headline: z.string(),
      })).optional().describe('Meta ad copy variants array'),
      emailSubject: z.string().optional(),
      emailPreheader: z.string().optional(),
      emailBody: z.string().optional().describe('Email HTML body'),
      smsBody: z.string().optional(),
      googleAdData: z.record(z.string(), z.unknown()).optional().describe('Google ad data (headlines, descriptions, sitelinks)'),
      metaLeadFormData: z.record(z.string(), z.unknown()).optional().describe('Meta lead form configuration'),
      status: z.enum(['draft', 'internal_review', 'client_review']).optional().describe('Initial status. Default: draft'),
    }, async (args, extra) => {
      const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: project } = await sb.from('review_projects').select('id').eq('id', args.campaignId).eq('company_id', auth.companyId).single();
      if (!project) return txt('Campaign not found');
      const { count } = await sb.from('review_items').select('id', { count: 'exact', head: true }).eq('review_project_id', args.campaignId);
      const row: Record<string, unknown> = {
        review_project_id: args.campaignId,
        company_id: auth.companyId,
        title: args.title,
        type: args.type,
        sort_order: (count || 0) + 1,
        status: args.status || 'draft',
        version: 1,
        created_by: auth.userId,
      };
      if (args.url !== undefined) row.url = args.url;
      if (args.htmlContent !== undefined) row.html_content = args.htmlContent;
      if (args.imageUrl !== undefined) row.image_url = args.imageUrl;
      if (args.videoUrl !== undefined) row.video_url = args.videoUrl;
      if (args.pdfUrl !== undefined) row.pdf_url = args.pdfUrl;
      if (args.adHeadline !== undefined) row.ad_headline = args.adHeadline;
      if (args.adCopy !== undefined) row.ad_copy = args.adCopy;
      if (args.adCta !== undefined) row.ad_cta = args.adCta;
      if (args.adCreativeUrl !== undefined) { row.ad_creative_url = args.adCreativeUrl; if (args.type === 'ad') row.image_url = args.adCreativeUrl; }
      if (args.adPlatform !== undefined) row.ad_platform = args.adPlatform;
      if (args.metaAdVariants !== undefined) row.meta_ad_variants = args.metaAdVariants;
      if (args.emailSubject !== undefined) row.email_subject = args.emailSubject;
      if (args.emailPreheader !== undefined) row.email_preheader = args.emailPreheader;
      if (args.emailBody !== undefined) row.email_body = args.emailBody;
      if (args.smsBody !== undefined) row.sms_body = args.smsBody;
      if (args.googleAdData !== undefined) row.google_ad_data = args.googleAdData;
      if (args.metaLeadFormData !== undefined) row.meta_lead_form_data = args.metaLeadFormData;
      const { data, error } = await sb.from('review_items').insert(row).select('id, title, type, status, sort_order').single();
      if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
      return json({ id: data.id, title: data.title, type: data.type, status: data.status, sortOrder: data.sort_order });
    });

    server.tool('create_asset_version', 'Upload a new version of an existing asset. Mirrors content to the parent item and optionally resets the workflow stage.', {
      assetId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
      notes: z.string().optional().describe('Version notes (e.g. "Updated headline per client feedback")'),
      resetToStage: z.enum(['draft', 'internal_review', 'client_review']).optional().describe('Reset asset to this stage after version is created. Clears prior approval votes for the stage.'),
      url: z.string().optional(),
      htmlContent: z.string().optional(),
      imageUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      pdfUrl: z.string().optional(),
      adHeadline: z.string().optional(),
      adCopy: z.string().optional(),
      adCta: z.string().optional(),
      adCreativeUrl: z.string().optional(),
      adPlatform: z.string().optional(),
      metaAdVariants: z.array(z.object({
        id: z.string(), label: z.string().optional(), primary_text: z.string(), headline: z.string(),
      })).optional(),
      emailSubject: z.string().optional(),
      emailPreheader: z.string().optional(),
      emailBody: z.string().optional(),
      smsBody: z.string().optional(),
      googleAdData: z.record(z.string(), z.unknown()).optional(),
      metaLeadFormData: z.record(z.string(), z.unknown()).optional(),
    }, async (args, extra) => {
      const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('*').eq('id', args.assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const nextVersion = (item.version || 1) + 1;
      // Snapshot v1 before creating the first v2 — preserves original content
      // so the version picker can show the real v1 after MIRROR_FIELDS overwrites the item row.
      if (nextVersion === 2) {
        const { count } = await sb.from('review_item_versions').select('id', { count: 'exact', head: true }).eq('review_item_id', args.assetId);
        if (!count) {
          const V1_FIELDS = ['url', 'html_content', 'image_url', 'video_url', 'pdf_url', 'ad_headline', 'ad_copy', 'ad_cta', 'ad_creative_url', 'ad_platform', 'meta_ad_variants', 'email_subject', 'email_preheader', 'email_body', 'sms_body', 'google_ad_data', 'meta_lead_form_data'];
          const v1Snap: Record<string, unknown> = { review_item_id: args.assetId, company_id: auth.companyId, version_number: 1, notes: null, created_by: item.created_by, created_at: item.created_at };
          for (const f of V1_FIELDS) { if (item[f] !== null && item[f] !== undefined) v1Snap[f] = item[f]; }
          await sb.from('review_item_versions').insert(v1Snap);
        }
      }
      const versionRow: Record<string, unknown> = {
        review_item_id: args.assetId,
        company_id: auth.companyId,
        version_number: nextVersion,
        notes: args.notes ?? null,
        created_by: auth.userId,
      };
      const CONTENT_MAP: [string, string][] = [
        ['url', 'url'], ['htmlContent', 'html_content'], ['imageUrl', 'image_url'],
        ['videoUrl', 'video_url'], ['pdfUrl', 'pdf_url'],
        ['adHeadline', 'ad_headline'], ['adCopy', 'ad_copy'], ['adCta', 'ad_cta'],
        ['adCreativeUrl', 'ad_creative_url'], ['adPlatform', 'ad_platform'],
        ['metaAdVariants', 'meta_ad_variants'],
        ['emailSubject', 'email_subject'], ['emailPreheader', 'email_preheader'],
        ['emailBody', 'email_body'], ['smsBody', 'sms_body'],
        ['googleAdData', 'google_ad_data'], ['metaLeadFormData', 'meta_lead_form_data'],
      ];
      for (const [param, col] of CONTENT_MAP) {
        const val = (args as Record<string, unknown>)[param];
        if (val !== undefined) versionRow[col] = val;
      }
      const { data: version, error: vErr } = await sb.from('review_item_versions').insert(versionRow).select('id, version_number').single();
      if (vErr || !version) return txt(`Failed to create version: ${vErr?.message || 'unknown'}`);
      const itemUpdate: Record<string, unknown> = {
        active_version_id: version.id,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      };
      const MIRROR_FIELDS = [
        'image_url', 'ad_creative_url', 'video_url', 'pdf_url',
        'email_subject', 'email_preheader', 'email_body', 'sms_body',
        'ad_headline', 'ad_copy', 'ad_cta', 'ad_platform', 'meta_ad_variants',
        'google_ad_data', 'meta_lead_form_data',
      ];
      for (const col of MIRROR_FIELDS) {
        if (versionRow[col] !== undefined) itemUpdate[col] = versionRow[col];
      }
      if (args.resetToStage && args.resetToStage !== item.status) {
        itemUpdate.status = args.resetToStage;
        itemUpdate.prior_status = item.status;
      }
      await sb.from('review_items').update(itemUpdate).eq('id', args.assetId);
      const stageToClear = args.resetToStage || item.status;
      if (stageToClear) {
        await sb.from('review_item_decisions').delete().eq('review_item_id', args.assetId).eq('stage', stageToClear);
      }
      return json({ versionId: version.id, versionNumber: version.version_number, assetId: args.assetId, status: (args.resetToStage || item.status) });
    });

    server.tool('update_asset_content', 'Update content fields on an asset (writes to the active version if v2+, or the item itself for v1). Use for editing copy, URLs, or content without creating a new version.', {
      assetId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
      title: z.string().optional(),
      url: z.string().optional(),
      htmlContent: z.string().optional(),
      imageUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      pdfUrl: z.string().optional(),
      adHeadline: z.string().optional(),
      adCopy: z.string().optional(),
      adCta: z.string().optional(),
      adCreativeUrl: z.string().optional(),
      adPlatform: z.string().optional(),
      metaAdVariants: z.array(z.object({
        id: z.string(), label: z.string().optional(), primary_text: z.string(), headline: z.string(),
      })).optional(),
      emailSubject: z.string().optional(),
      emailPreheader: z.string().optional(),
      emailBody: z.string().optional(),
      smsBody: z.string().optional(),
      googleAdData: z.record(z.string(), z.unknown()).optional(),
      metaLeadFormData: z.record(z.string(), z.unknown()).optional(),
    }, async (args, extra) => {
      const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: item } = await sb.from('review_items').select('id, version, active_version_id').eq('id', args.assetId).eq('company_id', auth.companyId).single();
      if (!item) return txt('Asset not found');
      const CONTENT_MAP: [string, string][] = [
        ['url', 'url'], ['htmlContent', 'html_content'], ['imageUrl', 'image_url'],
        ['videoUrl', 'video_url'], ['pdfUrl', 'pdf_url'],
        ['adHeadline', 'ad_headline'], ['adCopy', 'ad_copy'], ['adCta', 'ad_cta'],
        ['adCreativeUrl', 'ad_creative_url'], ['adPlatform', 'ad_platform'],
        ['metaAdVariants', 'meta_ad_variants'],
        ['emailSubject', 'email_subject'], ['emailPreheader', 'email_preheader'],
        ['emailBody', 'email_body'], ['smsBody', 'sms_body'],
        ['googleAdData', 'google_ad_data'], ['metaLeadFormData', 'meta_lead_form_data'],
      ];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      let fieldCount = 0;
      if (args.title !== undefined) { patch.title = args.title; fieldCount++; }
      for (const [param, col] of CONTENT_MAP) {
        const val = (args as Record<string, unknown>)[param];
        if (val !== undefined) { patch[col] = val; fieldCount++; }
      }
      if (fieldCount === 0) return txt('No fields to update — pass at least one content field.');
      if (item.active_version_id) {
        const versionPatch = { ...patch };
        delete versionPatch.title;
        if (Object.keys(versionPatch).length > 1) {
          const { error: vErr } = await sb.from('review_item_versions').update(versionPatch).eq('id', item.active_version_id);
          if (vErr) return txt(`Failed to update version: ${vErr.message}`);
        }
      }
      const { error } = await sb.from('review_items').update(patch).eq('id', args.assetId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt(`Asset updated (${fieldCount} field${fieldCount > 1 ? 's' : ''}).`);
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

    server.tool('update_proposal_status', 'Move a proposal or quote through the pipeline. Agency-side: draft↔sent. Use "draft" to pull back a sent proposal for edits.', {
      proposalId: z.string(),
      status: z.enum(['draft', 'sent']).describe('"sent" marks it as sent to the client. "draft" pulls it back for editing.'),
    }, async ({ proposalId, status }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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

    server.tool('add_proposal_page', 'Add a new page to a proposal. Returns the new page ID. For PDF pages, provide a filePath (Supabase storage path in the "proposals" bucket).', {
      proposalId: z.string(),
      type: z.enum(['text', 'pdf', 'pricing', 'packages', 'toc', 'section']).describe('Page type'),
      title: z.string().optional().describe('Page title (auto-generated if omitted)'),
      position: z.number().optional().describe('Insert at this position (0-based). Omit to append at the end.'),
      content: z.string().optional().describe('HTML content for text pages'),
      filePath: z.string().optional().describe('Supabase storage path for PDF pages (e.g. "proposals/{id}/page-3.pdf")'),
      indent: z.number().optional().describe('Indentation level (0-3). Default: 0'),
      enabled: z.boolean().optional().describe('Whether page is visible. Default: true'),
      showTitle: z.boolean().optional().describe('Show title on page. Default: true'),
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
      if (!p) return txt('Proposal not found');

      if (args.type === 'pdf' && !args.filePath) return txt('filePath is required for PDF pages.');

      const payload: Record<string, unknown> = {};
      if (args.content && args.type === 'text') {
        payload.html = args.content;
      }
      if (args.filePath && args.type === 'pdf') {
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

    server.tool('upload_proposal_file', 'Upload a file to the proposals storage bucket from a URL. Returns the filePath to use with add_proposal_page or update_proposal_page. Supports PDF, PNG, JPG, SVG, WEBP.', {
      proposalId: z.string().describe('Proposal ID — used to namespace the storage path'),
      url: z.string().describe('Public URL to fetch the file from'),
      fileName: z.string().optional().describe('Override filename (e.g. "slide-1.pdf"). Auto-detected from URL if omitted.'),
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
      if (!p) return txt('Proposal not found');

      let res: Response;
      try {
        res = await fetch(args.url, { redirect: 'follow' });
      } catch (e) {
        return txt(`Failed to fetch URL: ${e instanceof Error ? e.message : 'network error'}`);
      }
      if (!res.ok) return txt(`URL returned ${res.status} ${res.statusText}`);

      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const ALLOWED_TYPES: Record<string, string> = {
        'application/pdf': '.pdf',
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/svg+xml': '.svg',
        'image/webp': '.webp',
      };
      const mimeBase = contentType.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES[mimeBase]) return txt(`Unsupported content type: ${mimeBase}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);

      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) return txt('Downloaded file is empty.');
      if (bytes.byteLength > 50 * 1024 * 1024) return txt('File too large (max 50MB).');

      const sanitizedId = args.proposalId.replace(/[^a-zA-Z0-9._-]/g, '');
      let name = args.fileName;
      if (!name) {
        try {
          const urlPath = new URL(args.url).pathname;
          name = urlPath.split('/').pop() || `file${ALLOWED_TYPES[mimeBase]}`;
        } catch {
          name = `file${ALLOWED_TYPES[mimeBase]}`;
        }
      }
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `proposals/${sanitizedId}/${safeName}`;

      const { error: uploadErr } = await sb.storage.from('proposals').upload(filePath, Buffer.from(bytes), {
        contentType: mimeBase,
        upsert: true,
      });

      if (uploadErr) return txt(`Upload failed: ${uploadErr.message}`);

      return json({ filePath, contentType: mimeBase, sizeBytes: bytes.byteLength });
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
      if (!p) return txt('Proposal not found');

      const result = await reorderPages(sb, 'proposal', { entityId: args.proposalId, orderedIds: args.orderedPageIds });
      if (!result.success) return txt(`Failed: ${result.error || 'unknown'}`);
      return txt(`Pages reordered (${args.orderedPageIds.length} pages).`);
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

    server.tool('get_funnel', 'Get funnel detail with all steps, edges, and shapes.', {
      funnelId: z.string(),
    }, async ({ funnelId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
        isTemplate: funnel.is_template, shareToken: funnel.share_token,
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
      const { data, error } = await sb.from('funnels').insert(row).select('id, share_token').single();
      if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
      return json({ id: data.id, shareToken: data.share_token });
    });

    server.tool('update_funnel', 'Update funnel name, description, status, currency, or forecast settings.', {
      funnelId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'active', 'archived']).optional(),
      currency: z.enum(['USD', 'AUD', 'GBP', 'EUR', 'CAD', 'NZD']).optional(),
      forecastPeriod: z.enum(['total', 'monthly', 'yearly']).optional(),
      defaultDealValue: z.number().optional(),
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ funnelId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ stepId, funnelId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async (args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
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
    }, async ({ edgeId, funnelId }, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: e } = await sb.from('funnel_board_edges').select('id').eq('id', edgeId).eq('funnel_id', funnelId).eq('company_id', auth.companyId).single();
      if (!e) return txt('Edge not found');
      const { error } = await sb.from('funnel_board_edges').delete().eq('id', edgeId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt('Edge deleted.');
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  WORKSPACE (Company, Team, Clients)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    server.tool('list_companies', 'List all companies you have access to. Super admins see all companies; regular users see only their own.', {}, async (_args, extra) => {
      const auth = getAuth(extra); if (!auth) return unauthorized();
      const sb = createServiceClient();
      if (auth.isSuperAdmin) {
        const { data, error } = await sb.from('companies').select('id, name, slug, account_type, created_at').order('name', { ascending: true });
        if (error) return txt(`Error: ${error.message}`);
        return json((data || []).map(c => ({ id: c.id, name: c.name, slug: c.slug, type: c.account_type, createdAt: c.created_at })));
      }
      const { data: memberships } = await sb.from('team_members').select('company_id').eq('user_id', auth.userId);
      const companyIds = (memberships || []).map(m => m.company_id);
      if (!companyIds.length) return txt('No companies found.');
      const { data, error } = await sb.from('companies').select('id, name, slug, account_type, created_at').in('id', companyIds).order('name', { ascending: true });
      if (error) return txt(`Error: ${error.message}`);
      return json((data || []).map(c => ({ id: c.id, name: c.name, slug: c.slug, type: c.account_type, createdAt: c.created_at })));
    });

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
    serverInfo: { name: 'agencyviz', version: '1.3.0' },
  },
  {
    streamableHttpEndpoint: '/api/mcp',
    sseEndpoint: '/api/mcp/sse',
    sseMessageEndpoint: '/api/mcp/message',
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
  const { data: member } = await sb.from('team_members').select('id, name, email, role, is_super_admin').eq('user_id', key.user_id).eq('company_id', key.company_id).single();
  if (!member) return undefined;
  sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {});
  return {
    token: bearerToken, clientId: 'mcp', scopes: ['campaigns:read', 'campaigns:write'],
    companyId: key.company_id, userId: key.user_id, memberId: member.id,
    memberName: member.name || member.email || 'Unknown', role: member.role,
    isSuperAdmin: !!member.is_super_admin,
  };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io';

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceUrl: APP_URL,
});

export { handler as GET, handler as POST, handler as DELETE };
