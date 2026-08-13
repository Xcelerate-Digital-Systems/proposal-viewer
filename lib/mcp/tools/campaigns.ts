import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { checkResourceLimit } from '@/lib/billing/entitlements';
import { getAuth, unauthorized, txt, json, type McpServer, type McpAuthInfo } from '@/lib/mcp/types';

export function registerCampaignTools(server: McpServer) {

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

    server.tool('create_campaign', 'Create a new campaign (review project). Returns the new campaign ID.', {
      title: z.string().describe('Campaign title'),
      projectType: z.enum(['campaign', 'asset', 'website']).optional().describe('Project type. Default: campaign'),
      description: z.string().optional(),
      clientName: z.string().optional().describe('Client contact name'),
      clientEmail: z.string().optional().describe('Client contact email'),
      clientCompany: z.string().optional().describe('Client company name'),
      rootDomain: z.string().optional().describe('Root domain of the site under review'),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ title, projectType, description, clientName, clientEmail, clientCompany, rootDomain, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const trimmed = title.trim();
      if (!trimmed) return txt('Title is required');
      const limitCheck = await checkResourceLimit(auth.companyId, 'reviews');
      if (!limitCheck.allowed) return txt(`Plan limit reached: your plan does not allow more campaigns (${limitCheck.used}/${limitCheck.limit ?? '∞'}). Upgrade to create more.`);
      const sb = createServiceClient();
      const { data: created, error } = await sb.from('review_projects').insert({
        company_id: auth.companyId,
        project_type: projectType || 'campaign',
        title: trimmed,
        description: description?.trim() || null,
        client_name: clientName?.trim() || null,
        client_email: clientEmail?.trim() || null,
        client_company: clientCompany?.trim() || null,
        root_domain: rootDomain?.trim() || null,
        created_by: auth.userId,
      }).select('id, title, project_type, status, share_token').single();
      if (error || !created) return txt(`Failed: ${error?.message || 'unknown'}`);
      await sb.from('review_project_assignees').upsert(
        { review_project_id: created.id, team_member_id: auth.memberId },
        { onConflict: 'review_project_id,team_member_id' },
      );
      return json({ id: created.id, title: created.title, projectType: created.project_type, status: created.status, shareToken: created.share_token });
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, since, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ commentId, note, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: comment } = await sb.from('review_comments').select('id, review_item_id, review_project_id, company_id').eq('id', commentId).eq('company_id', auth.companyId).single();
      if (!comment) return txt('Comment not found');
      let noteAdded = false;
      let noteError: string | null = null;
      if (note?.trim()) {
        const { error: noteErr } = await sb.from('review_comments').insert({
          review_item_id: comment.review_item_id, review_project_id: comment.review_project_id,
          company_id: comment.company_id, parent_comment_id: commentId,
          content: note.trim(), author_name: auth.memberName, author_user_id: auth.userId,
          author_type: 'team', comment_type: 'general',
        });
        // Never claim the note landed when it did not: the caller is usually
        // telling a client something, and a silent drop loses that message.
        if (noteErr) noteError = noteErr.message; else noteAdded = true;
      }
      const { error } = await sb.from('review_comments').update({ resolved: true, resolved_by: auth.memberName, resolved_at: new Date().toISOString() }).eq('id', commentId);
      if (error) return txt(`Failed: ${error.message}`);
      if (noteError) return txt(`Comment ${commentId} resolved, but the note could NOT be added: ${noteError}`);
      return txt(`Comment ${commentId} resolved.${noteAdded ? ' Note added as reply.' : ''}`);
    });

    server.tool('add_comment', 'Add a comment to an asset. Can be a thread reply.', {
      assetId: z.string(), content: z.string(), parentCommentId: z.string().optional(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ assetId, content, parentCommentId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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
        parent_comment_id: parentCommentId || null, thread_number: threadNumber,
        // comment_type is NOT NULL with no default, and author_type defaults to
        // 'client' — an MCP comment is the agency talking, not the client.
        comment_type: 'general', author_type: 'team',
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
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, status, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
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

    server.tool('list_campaign_guests', 'List all guest reviewers on a campaign.', {
      campaignId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data, error } = await sb.from('review_project_guests')
        .select('id, name, email, stages, created_at')
        .eq('review_project_id', campaignId).eq('company_id', auth.companyId)
        .order('created_at', { ascending: true });
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No guests on this campaign.');
      return json(data);
    });

    server.tool('add_campaign_guest', 'Add a guest reviewer to a campaign.', {
      campaignId: z.string(),
      name: z.string(),
      email: z.string(),
      stages: z.array(z.string()).optional().describe('Stages the guest can see. Default: ["client_review"]'),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async (args, extra) => {
      const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: camp } = await sb.from('review_projects').select('id').eq('id', args.campaignId).eq('company_id', auth.companyId).single();
      if (!camp) return txt('Campaign not found');
      const { data, error } = await sb.from('review_project_guests').insert({
        review_project_id: args.campaignId, company_id: auth.companyId,
        name: args.name, email: args.email,
        stages: args.stages || ['client_review'],
      }).select('id, name, email').single();
      if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
      return json(data);
    });

    server.tool('remove_campaign_guest', 'Remove a guest reviewer from a campaign.', {
      guestId: z.string(),
      campaignId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ guestId, campaignId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: g } = await sb.from('review_project_guests').select('id')
        .eq('id', guestId).eq('review_project_id', campaignId).eq('company_id', auth.companyId).single();
      if (!g) return txt('Guest not found');
      const { error } = await sb.from('review_project_guests').delete().eq('id', guestId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt('Guest removed.');
    });

    server.tool('list_campaign_assignees', 'List team members assigned to a campaign.', {
      campaignId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: camp } = await sb.from('review_projects').select('id').eq('id', campaignId).eq('company_id', auth.companyId).single();
      if (!camp) return txt('Campaign not found');
      const { data, error } = await sb.from('review_project_assignees')
        .select('id, team_member_id, stages')
        .eq('review_project_id', campaignId);
      if (error) return txt(`Error: ${error.message}`);
      if (!data?.length) return txt('No assignees on this campaign.');
      const memberIds = data.map(a => (a as Record<string, unknown>).team_member_id as string);
      const { data: members } = await sb.from('team_members').select('id, name, email, role').in('id', memberIds);
      const memberMap = new Map((members || []).map(m => [(m as Record<string, unknown>).id, m]));
      return json(data.map(a => {
        const rec = a as Record<string, unknown>;
        const member = memberMap.get(rec.team_member_id as string) as Record<string, unknown> | undefined;
        return { id: rec.id, teamMemberId: rec.team_member_id, stages: rec.stages, memberName: member?.name, memberEmail: member?.email, memberRole: member?.role };
      }));
    });

    server.tool('assign_campaign_member', 'Assign a team member to a campaign.', {
      campaignId: z.string(),
      teamMemberId: z.string(),
      stages: z.array(z.string()).optional().describe('Stages to assign. Default: all stages'),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async (args, extra) => {
      const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { data: camp } = await sb.from('review_projects').select('id').eq('id', args.campaignId).eq('company_id', auth.companyId).single();
      if (!camp) return txt('Campaign not found');
      const { error } = await sb.from('review_project_assignees').upsert({
        review_project_id: args.campaignId, team_member_id: args.teamMemberId,
        stages: args.stages || ['draft', 'internal_review', 'client_review', 'approved', 'revision_needed', 'rejected'],
      }, { onConflict: 'review_project_id,team_member_id' });
      if (error) return txt(`Failed: ${error.message}`);
      return txt('Team member assigned.');
    });

    server.tool('unassign_campaign_member', 'Remove a team member assignment from a campaign.', {
      campaignId: z.string(),
      teamMemberId: z.string(),
      companyId: z.string().optional().describe('Super admin only: target a different company'),
    }, async ({ campaignId, teamMemberId, companyId }, extra) => {
      const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
      const sb = createServiceClient();
      const { error } = await sb.from('review_project_assignees').delete()
        .eq('review_project_id', campaignId).eq('team_member_id', teamMemberId);
      if (error) return txt(`Failed: ${error.message}`);
      return txt('Team member unassigned.');
    });

}
