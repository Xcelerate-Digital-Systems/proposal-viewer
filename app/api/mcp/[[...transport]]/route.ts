import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { createServiceClient } from '@/lib/supabase-server';
import { hashApiKey, API_KEY_PREFIX } from '@/lib/api-auth';
import { txt, type McpAuthInfo } from '@/lib/mcp/types';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { registerCampaignTools } from '@/lib/mcp/tools/campaigns';
import { registerProposalTools } from '@/lib/mcp/tools/proposals';
import { registerPricingTools } from '@/lib/mcp/tools/pricing';
import { registerDocumentTools } from '@/lib/mcp/tools/documents';
import { registerTemplateTools } from '@/lib/mcp/tools/templates';
import { registerSwipeTools } from '@/lib/mcp/tools/swipe';
import { registerFunnelTools } from '@/lib/mcp/tools/funnels';
import { registerWorkspaceTools } from '@/lib/mcp/tools/workspace';
import { registerDesignTools } from '@/lib/mcp/tools/design';
import { registerLibraryTools } from '@/lib/mcp/tools/library';
import { registerClientAccessTools } from '@/lib/mcp/tools/client-access';

const mcpHandler = createMcpHandler(
  (server) => {

    server.tool('get_guide', 'Returns a guide on how to use the AgencyViz MCP tools. Call this first.', {}, async () => txt(
`# AgencyViz MCP — Tool Guide

## Sections & Tools

### Campaigns (Feedback/Markup)
- \`list_campaigns\` → \`get_campaign\` → \`list_assets\` → \`get_asset_detail\`
- \`create_campaign\` — create a new campaign project (projectType: campaign | asset | website)
- \`create_asset\` — add a new asset to a campaign (any content type)
- \`create_asset_version\` — upload a new revision of an existing asset (optionally reset stage)
- \`update_asset_content\` — edit content fields in-place without creating a new version
- \`get_comments\` / \`get_unresolved\` — read feedback
- \`resolve_comment\`, \`add_comment\` — comment write ops
- \`update_asset_status\` — move a single asset between stages
- \`bulk_update_asset_status\` — move all (or filtered) assets in a campaign
- \`update_campaign_status\` — archive or activate a campaign project

### Pitch (Proposals + Quotes)
- \`list_proposals\` → \`get_proposal\` → \`get_proposal_pages\`
- \`create_proposal\` — create a new blank proposal or quote
- \`create_proposal_from_template\` — create a proposal pre-populated with template pages
- \`update_proposal\` — edit title, client info, description, branding fields
- \`update_proposal_status\` — mark as sent or pull back to draft
- \`upload_proposal_file\` — upload a file to the proposals storage bucket from a URL, or as base64 content for local files up to ~3MB (returns filePath for PDF pages)
- \`add_proposal_page\` — add a text/pdf/html/pricing/packages/toc/section page (html renders raw content in a sandboxed iframe — good for full-bleed designed pages)
- \`update_proposal_page\` — edit page title, content, or settings
- \`delete_proposal_page\` — remove a page
- \`reorder_proposal_pages\` — reorder pages by ID array
- Quotes are proposals with entity_type='pricing'

### Quote Pricing & Packages (works on proposal OR template pages)
- \`get_pricing_page\` — read line items, tax, payment schedule, column config from a pricing page
- \`set_pricing_line_items\` — write the full line items array (replaces existing)
- \`set_pricing_settings\` — update tax, intro text, payment schedule, column visibility
- \`get_packages_page\` — read package tiers, features, and styling from a packages page
- \`set_package_tiers\` — write the full package tiers array with features (replaces existing)
- All pricing/package tools accept \`proposalId\` OR \`templateId\` — pass one or the other

### Documents
- \`list_documents\` → \`get_document\`
- \`create_document\` — create a new document with a default Introduction page
- \`update_document\` — edit title or description
- \`delete_document\` — delete document and all pages
- \`add_document_page\` / \`update_document_page\` / \`delete_document_page\` — page CRUD

### Template Library
- \`list_templates\` → \`get_template\`
- \`create_template\` — create a new template (proposal or quote type)
- \`update_template\` — edit name or description
- \`delete_template\` — delete template and all pages
- \`upload_template_file\` — upload a file to the templates storage bucket (returns filePath for PDF pages — files live under templates/{id}/ so they're independent of any proposal)
- \`add_template_page\` / \`update_template_page\` / \`delete_template_page\` — page CRUD

### Swipe Vault
- \`list_swipe_collections\` → \`list_swipe_files\` → \`get_swipe_file\`
- \`create_swipe_collection\` / \`update_swipe_collection\` / \`delete_swipe_collection\` — collection CRUD
- \`create_swipe_file\` / \`update_swipe_file\` / \`delete_swipe_file\` — swipe file CRUD

### Funnel Planner
- \`list_funnels\` → \`get_funnel\` (includes steps, edges, and shapes)
- \`create_funnel\` — create a new empty funnel
- \`update_funnel\` — edit name, description, status, currency, forecast settings
- \`delete_funnel\` — delete a funnel and all its children
- \`list_funnel_node_types\` — list all valid step and shape types grouped by category (sources, pages, offers, stages, actions, drawing)
- \`list_funnel_icons\` — list all valid icon slugs (Lucide icons + brand logos). Invalid icons are rejected by create/update tools
- \`create_funnel_step\` — add a node (traffic source, page, offer, stage, or generic). Optional \`linkedFunnelId\` to cross-link to another funnel. Icon must be a valid slug from \`list_funnel_icons\`
- \`update_funnel_step\` — edit label, position, metrics, icon, color, stepType, or linkedFunnelId (no need to delete and recreate to change type). Icon must be a valid slug from \`list_funnel_icons\`
- \`delete_funnel_step\` — remove a node and its connected edges
- \`create_funnel_edge\` — connect two nodes/shapes with a labeled edge
- \`update_funnel_edge\` — edit label, handles, animation, split percent
- \`delete_funnel_edge\` — remove a connection
- \`create_funnel_shape\` — add a shape (sticky note, annotation, decision diamond, action node, etc.). Optional \`linkedFunnelId\` to cross-link to another funnel
- \`update_funnel_shape\` — edit position, size, content, color, stroke, type, or linkedFunnelId
- \`delete_funnel_shape\` — remove a shape and its connected edges
- \`list_funnel_templates\` — list saved funnel templates
- \`save_funnel_as_template\` — clone a funnel into a reusable template
- \`create_funnel_from_template\` — create a new funnel pre-populated from a template

### Client Access
- \`list_access_requests\` — list client access requests (filter by clientId, status)
- \`get_access_request\` — get a request with all grant details per platform
- \`create_access_request\` — create a new access link for a client (platforms, optional email invite)
- \`resend_access_invite\` — resend the invite email for an existing request
- \`revoke_access_request\` — revoke a link so it can't be used
- \`delete_access_request\` — permanently delete a request and all grants
- \`get_access_config\` — read the agency's connected platforms + emails
- \`update_access_config\` — update agency emails, default platforms

### Workspace
- \`get_company\` — company info and branding
- \`list_team_members\` — team roster
- \`list_clients\` — client companies
- \`create_client\` — create a new client company (Owner/Admin only)
- \`update_client\` — update client name, website, email, phone

## Key concepts
- Proposals flow: draft → sent → viewed → accepted/declined/revision_requested
- Campaign assets flow: draft → internal_review → client_review → approved/revision_needed/rejected
- Comments have pin coordinates (pin_x, pin_y as %) showing where feedback was placed
- Everything is scoped to your company — you only see your workspace's data
- **Super admins**: pass \`companyId\` on any campaign/asset tool to operate on a different company. Use \`list_companies\` to discover accessible companies.`));

    registerCampaignTools(server);
    registerProposalTools(server);
    registerPricingTools(server);
    registerDocumentTools(server);
    registerTemplateTools(server);
    registerSwipeTools(server);
    registerFunnelTools(server);
    registerWorkspaceTools(server);
    registerDesignTools(server);
    registerLibraryTools(server);
    registerClientAccessTools(server);
  },
  {
    capabilities: { tools: {} },
    serverInfo: { name: 'agencyviz', version: '1.10.0' },
    instructions: [
      'You are connected to the AgencyViz MCP — a B2B SaaS platform for agencies.',
      '',
      '## First thing to do',
      'Call `list_companies` immediately on your first turn to discover:',
      '1. Which companies the authenticated user can access',
      '2. Whether the user is a **super admin** (super admins see ALL companies; regular users see only their own)',
      '',
      'If multiple companies are returned, the user is a super admin. Ask which company they want to work with, or let them specify via the `companyId` parameter on any tool.',
      '',
      '## Key concepts',
      '- **Campaigns**: feedback/markup projects with assets that move through review stages',
      '- **Proposals & Quotes**: client-facing pitch documents with page editors',
      '- **Funnel Planner**: visual funnel builders with steps and edges',
      '- **Template Library**: reusable page and package templates',
      '- **Swipe Vault**: ad reference collections',
      '',
      'Call `get_guide` for the full tool reference when you need detailed workflow information.',
    ].join('\n'),
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
