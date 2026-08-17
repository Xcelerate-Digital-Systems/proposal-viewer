import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';
import { VALID_PLATFORMS, PLATFORM_LABELS, type AccessPlatform } from '@/lib/client-access/types';
import { sendAccessInviteEmail } from '@/lib/client-access/emails';

export function registerClientAccessTools(server: McpServer) {

  server.tool('list_access_requests', 'List client access requests for this agency. Optionally filter by client_id or status.', {
    clientId: z.string().optional().describe('Filter by client company ID'),
    status: z.enum(['pending', 'partial', 'complete', 'expired', 'revoked']).optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    let query = sb
      .from('client_access_requests')
      .select('id, share_token, platforms, status, client_name, client_email, notes, expires_at, created_at, updated_at')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });
    if (args.clientId) query = query.eq('client_id', args.clientId);
    if (args.status) query = query.eq('status', args.status);
    const { data, error } = await query.limit(50);
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No access requests found.');
    return json(data);
  });

  server.tool('get_access_request', 'Get a single access request with all grant details.', {
    requestId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: req } = await sb
      .from('client_access_requests')
      .select('id, share_token, platforms, status, client_name, client_email, notes, expires_at, created_at, updated_at')
      .eq('id', args.requestId)
      .eq('company_id', auth.companyId)
      .single();
    if (!req) return txt('Access request not found.');
    const { data: grants } = await sb
      .from('client_access_grants')
      .select('id, platform, status, platform_account_name, error_message, granted_at, created_at')
      .eq('request_id', args.requestId)
      .order('created_at', { ascending: true });
    return json({
      ...req,
      platforms_labels: (req.platforms as string[]).map((p) => PLATFORM_LABELS[p as AccessPlatform] || p),
      grants: (grants || []).map((g) => ({
        ...g,
        platform_label: PLATFORM_LABELS[g.platform as AccessPlatform] || g.platform,
      })),
    });
  });

  server.tool('create_access_request', 'Create a new client access request link. Returns the share URL. Optionally sends an invite email.', {
    platforms: z.array(z.string()).describe(`Platforms to request access to: ${VALID_PLATFORMS.join(', ')}`),
    clientId: z.string().optional().describe('Link to a client company'),
    clientName: z.string().optional(),
    clientEmail: z.string().optional().describe('Client email — if provided with sendEmail=true, an invite email is sent'),
    notes: z.string().optional().describe('Optional instructions shown to the client'),
    expiresInDays: z.number().optional().describe('Expire the link after N days (default: no expiry)'),
    sendEmail: z.boolean().optional().describe('Send an invite email to clientEmail (default: false)'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    if (auth.role !== 'owner' && auth.role !== 'admin' && !auth.isSuperAdmin) {
      return txt('Permission denied: requires Owner or Admin role.');
    }

    const invalid = args.platforms.filter((p) => !VALID_PLATFORMS.includes(p as AccessPlatform));
    if (invalid.length) return txt(`Invalid platforms: ${invalid.join(', ')}. Valid: ${VALID_PLATFORMS.join(', ')}`);
    if (!args.platforms.length) return txt('At least one platform is required.');

    const sb = createServiceClient();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io').replace(/\/+$/, '');

    const expiresAt = args.expiresInDays
      ? new Date(Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: req, error } = await sb
      .from('client_access_requests')
      .insert({
        company_id: auth.companyId,
        client_id: args.clientId || null,
        platforms: args.platforms,
        status: 'pending',
        client_name: args.clientName || null,
        client_email: args.clientEmail || null,
        notes: args.notes || null,
        expires_at: expiresAt,
        created_by: auth.userId,
      })
      .select('id, share_token')
      .single();

    if (error || !req) return txt(`Failed: ${error?.message || 'unknown'}`);

    const grantInserts = args.platforms.map((p) => ({
      request_id: req.id,
      platform: p,
      status: 'pending',
    }));

    await sb.from('client_access_grants').insert(grantInserts);

    const accessUrl = `${appUrl}/access/${req.share_token}`;

    if (args.sendEmail && args.clientEmail) {
      try {
        const { data: company } = await sb.from('companies').select('name').eq('id', auth.companyId).single();
        await sendAccessInviteEmail({
          to: args.clientEmail,
          agencyName: company?.name || 'Your Agency',
          clientName: args.clientName || null,
          accessUrl,
          notes: args.notes || null,
          companyId: auth.companyId,
          requestId: req.id,
        });
      } catch (err) {
        return json({ id: req.id, url: accessUrl, emailError: (err as Error).message });
      }
    }

    return json({ id: req.id, url: accessUrl, emailSent: !!(args.sendEmail && args.clientEmail) });
  });

  server.tool('resend_access_invite', 'Resend the invite email for an existing access request.', {
    requestId: z.string(),
    clientEmail: z.string().optional().describe('Override the email address (uses stored email if omitted)'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io').replace(/\/+$/, '');

    const { data: req } = await sb
      .from('client_access_requests')
      .select('id, share_token, client_name, client_email, notes, status')
      .eq('id', args.requestId)
      .eq('company_id', auth.companyId)
      .single();

    if (!req) return txt('Access request not found.');
    if (req.status === 'complete') return txt('This request is already complete.');
    if (req.status === 'revoked') return txt('This request has been revoked.');

    const email = args.clientEmail || req.client_email;
    if (!email) return txt('No email address available. Pass clientEmail to specify one.');

    const { data: company } = await sb.from('companies').select('name').eq('id', auth.companyId).single();

    await sendAccessInviteEmail({
      to: email,
      agencyName: company?.name || 'Your Agency',
      clientName: req.client_name,
      accessUrl: `${appUrl}/access/${req.share_token}`,
      notes: req.notes,
      companyId: auth.companyId,
      requestId: req.id,
    });

    return txt(`Invite email sent to ${email}.`);
  });

  server.tool('revoke_access_request', 'Revoke an access request, making the link unusable.', {
    requestId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data } = await sb
      .from('client_access_requests')
      .select('id')
      .eq('id', args.requestId)
      .eq('company_id', auth.companyId)
      .single();
    if (!data) return txt('Access request not found.');
    const { error } = await sb
      .from('client_access_requests')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', args.requestId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Access request revoked.');
  });

  server.tool('delete_access_request', 'Delete an access request and all its grant data. Requires Owner or Admin role.', {
    requestId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    if (auth.role !== 'owner' && auth.role !== 'admin' && !auth.isSuperAdmin) {
      return txt('Permission denied: requires Owner or Admin role.');
    }
    const sb = createServiceClient();
    const { data } = await sb
      .from('client_access_requests')
      .select('id')
      .eq('id', args.requestId)
      .eq('company_id', auth.companyId)
      .single();
    if (!data) return txt('Access request not found.');
    await sb.from('client_access_grants').delete().eq('request_id', args.requestId);
    await sb.from('client_access_oauth_states').delete().eq('access_request_id', args.requestId);
    const { error } = await sb.from('client_access_requests').delete().eq('id', args.requestId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Access request deleted.');
  });

  server.tool('get_access_config', 'Get the agency\'s client access configuration (connected platforms, emails, MCC ID).', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data } = await sb
      .from('agency_access_config')
      .select('universal_share_token, default_platforms, platform_config, meta_business_id, meta_business_name, google_mcc_id, google_mcc_name, google_analytics_email, google_gtm_email, google_gbp_email, google_search_console_email, google_merchant_center_email, google_user_name, wordpress_admin_email')
      .eq('company_id', auth.companyId)
      .maybeSingle();
    if (!data) return txt('No access configuration found. Set it up in Settings → Client Access.');
    return json(data);
  });

  server.tool('update_access_config', 'Update the agency\'s client access configuration (emails, default platforms). Requires Owner or Admin.', {
    googleAnalyticsEmail: z.string().optional(),
    googleGtmEmail: z.string().optional(),
    googleGbpEmail: z.string().optional(),
    googleSearchConsoleEmail: z.string().optional(),
    googleMerchantCenterEmail: z.string().optional(),
    wordpressAdminEmail: z.string().optional(),
    defaultPlatforms: z.array(z.string()).optional().describe('Default platforms for new requests'),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    if (auth.role !== 'owner' && auth.role !== 'admin' && !auth.isSuperAdmin) {
      return txt('Permission denied: requires Owner or Admin role.');
    }
    const sb = createServiceClient();
    const updates: Record<string, unknown> = { company_id: auth.companyId, updated_at: new Date().toISOString() };
    if (args.googleAnalyticsEmail !== undefined) updates.google_analytics_email = args.googleAnalyticsEmail || null;
    if (args.googleGtmEmail !== undefined) updates.google_gtm_email = args.googleGtmEmail || null;
    if (args.googleGbpEmail !== undefined) updates.google_gbp_email = args.googleGbpEmail || null;
    if (args.googleSearchConsoleEmail !== undefined) updates.google_search_console_email = args.googleSearchConsoleEmail || null;
    if (args.googleMerchantCenterEmail !== undefined) updates.google_merchant_center_email = args.googleMerchantCenterEmail || null;
    if (args.wordpressAdminEmail !== undefined) updates.wordpress_admin_email = args.wordpressAdminEmail || null;
    if (args.defaultPlatforms !== undefined) updates.default_platforms = args.defaultPlatforms;
    const { error } = await sb.from('agency_access_config').upsert(updates, { onConflict: 'company_id' });
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Access configuration updated.');
  });
}
