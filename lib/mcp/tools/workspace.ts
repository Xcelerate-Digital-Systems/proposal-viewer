import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

export function registerWorkspaceTools(server: McpServer) {
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

  server.tool('get_company', 'Get company profile, branding, and settings.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: c } = await sb.from('companies')
      .select('id, name, slug, website, phone, contact_email, abn, address, accent_color, font_heading, font_body, custom_domain, domain_verified, account_type, brand_colors, created_at')
      .eq('id', auth.companyId).single();
    if (!c) return txt('Company not found');
    return json(c);
  });

  server.tool('list_team_members', 'List all team members in the workspace.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('team_members')
      .select('id, name, email, role, created_at')
      .eq('company_id', auth.companyId).order('created_at', { ascending: true });
    if (error) return txt(`Error: ${error.message}`);
    return json((data || []).map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role, joinedAt: m.created_at })));
  });

  server.tool('list_clients', 'List client companies linked to this agency.', {
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async ({ companyId }, extra) => {
    const auth = getAuth(extra, companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('companies')
      .select('id, name, slug, website, contact_email, phone, created_at')
      .eq('agency_id', auth.companyId).eq('account_type', 'client').order('name', { ascending: true });
    if (error) return txt(`Error: ${error.message}`);
    if (!data?.length) return txt('No client companies found.');
    return json(data);
  });

  server.tool('create_client', 'Create a new client company linked to this agency. Requires Owner or Admin role.', {
    name: z.string(),
    slug: z.string().describe('URL-safe slug (lowercase, hyphens)'),
    website: z.string().optional(),
    contactEmail: z.string().optional(),
    phone: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    if (auth.role !== 'owner' && auth.role !== 'admin') return txt('Only owners and admins can create clients.');
    const sb = createServiceClient();
    const { data: existing } = await sb.from('companies').select('id').eq('slug', args.slug).maybeSingle();
    if (existing) return txt(`Slug "${args.slug}" is already taken.`);
    const { data, error } = await sb.from('companies').insert({
      name: args.name, slug: args.slug, account_type: 'client',
      agency_id: auth.companyId, website: args.website || null,
      contact_email: args.contactEmail || null, phone: args.phone || null,
    }).select('id, name, slug').single();
    if (error || !data) return txt(`Failed: ${error?.message || 'unknown'}`);
    return json({ id: data.id, name: data.name, slug: data.slug });
  });

  server.tool('update_client', 'Update a client company.', {
    clientId: z.string(),
    name: z.string().optional(),
    website: z.string().optional(),
    contactEmail: z.string().optional(),
    phone: z.string().optional(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: c } = await sb.from('companies').select('id').eq('id', args.clientId).eq('agency_id', auth.companyId).eq('account_type', 'client').single();
    if (!c) return txt('Client not found');
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.website !== undefined) updates.website = args.website;
    if (args.contactEmail !== undefined) updates.contact_email = args.contactEmail;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (Object.keys(updates).length === 0) return txt('No fields to update.');
    const { error } = await sb.from('companies').update(updates).eq('id', args.clientId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt('Client updated.');
  });
}
