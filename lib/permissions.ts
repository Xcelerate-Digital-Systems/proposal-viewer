// lib/permissions.ts
//
// Single source of truth for what each team role can do. Drives the visual
// permissions matrix on /settings?tab=roles and is intended to be the
// reference all code-level gates check against — call canRole(role, key) at
// permission boundaries instead of comparing role strings inline.
//
// Roles are not customisable per company. Filestage's screenshot uses Admin /
// Manager / Member; we use Owner / Admin / Member for back-compat with the
// existing team_members.role enum. Owner is the strongest role and bills the
// account; Admin handles day-to-day; Member is read/write on content but
// can't shape the team or the company.

export type TeamRole = 'owner' | 'admin' | 'member';

export const TEAM_ROLES: TeamRole[] = ['owner', 'admin', 'member'];

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: 'Founder-level account control. Manages billing, the team, and every project.',
  admin: 'Day-to-day operator. Manages team and projects, but not billing.',
  member: 'Hands-on collaborator. Edits content but can\'t reshape the team or company.',
};

/** A single permission key. Lowercase snake_case so identifiers stay grep-able. */
export type PermissionKey =
  // Project-scope
  | 'access_all_projects'
  | 'manage_projects'
  | 'manage_project_templates'
  | 'upload_new_files'
  | 'manage_automations'
  // Team-scope
  | 'invite_members'
  | 'invite_owners'
  | 'remove_members'
  | 'change_roles'
  // Company-scope
  | 'manage_billing'
  | 'manage_branding'
  | 'manage_integrations'
  | 'manage_custom_domain'
  | 'view_insights'
  | 'manage_api_keys';

export type PermissionGroupKey = 'projects' | 'team' | 'company';

export interface PermissionDef {
  key: PermissionKey;
  group: PermissionGroupKey;
  label: string;
  description?: string;
  /** true | false | 'partial' (with a label override for the partial cell). */
  grants: Record<TeamRole, true | false | { partial: string }>;
}

export const PERMISSION_GROUPS: { key: PermissionGroupKey; label: string }[] = [
  { key: 'projects', label: 'Project permissions' },
  { key: 'team',     label: 'Team permissions' },
  { key: 'company',  label: 'Company permissions' },
];

/**
 * The canonical matrix. Update this when adding a permission or shifting a
 * role's scope — code-level gates should call canRole() against it.
 */
export const PERMISSION_MATRIX: PermissionDef[] = [
  {
    key: 'access_all_projects',
    group: 'projects',
    label: 'Access all projects',
    description: 'See and open every project in the company.',
    grants: {
      owner:  true,
      admin:  true,
      member: { partial: 'Only projects they\'re invited to' },
    },
  },
  {
    key: 'manage_projects',
    group: 'projects',
    label: 'Manage projects',
    description: 'Create, rename, archive, and delete feedback / proposal projects.',
    grants: { owner: true, admin: true, member: true },
  },
  {
    key: 'upload_new_files',
    group: 'projects',
    label: 'Upload new files',
    description: 'Add items and new versions inside a project.',
    grants: { owner: true, admin: true, member: true },
  },
  {
    key: 'manage_project_templates',
    group: 'projects',
    label: 'Manage project templates',
    description: 'Edit the templates new proposals start from.',
    grants: { owner: true, admin: true, member: false },
  },
  {
    key: 'manage_automations',
    group: 'projects',
    label: 'Manage automations',
    description: 'Webhooks and integration triggers that fire on review events.',
    grants: { owner: true, admin: true, member: true },
  },
  {
    key: 'view_insights',
    group: 'projects',
    label: 'View insights',
    description: 'Cross-project analytics — view counts, acceptance rate, etc.',
    grants: { owner: true, admin: true, member: false },
  },

  {
    key: 'invite_members',
    group: 'team',
    label: 'Invite members',
    description: 'Send invites to add new teammates as Members.',
    grants: { owner: true, admin: true, member: false },
  },
  {
    key: 'invite_owners',
    group: 'team',
    label: 'Invite owners',
    description: 'Promote teammates to the Owner role.',
    grants: { owner: true, admin: false, member: false },
  },
  {
    key: 'remove_members',
    group: 'team',
    label: 'Remove members',
    description: 'Revoke seats and remove access to the workspace.',
    grants: { owner: true, admin: true, member: false },
  },
  {
    key: 'change_roles',
    group: 'team',
    label: 'Change roles',
    description: 'Move teammates between Owner / Admin / Member.',
    grants: { owner: true, admin: true, member: false },
  },

  {
    key: 'manage_billing',
    group: 'company',
    label: 'Manage billing',
    description: 'Change plan, payment method, view invoices.',
    grants: { owner: true, admin: false, member: false },
  },
  {
    key: 'manage_branding',
    group: 'company',
    label: 'Manage branding',
    description: 'Logos, colours, and templates used by client-facing pages.',
    grants: { owner: true, admin: true, member: false },
  },
  {
    key: 'manage_integrations',
    group: 'company',
    label: 'Manage integrations',
    description: 'Connect Meta, Looker Studio, and other external services.',
    grants: { owner: true, admin: true, member: false },
  },
  {
    key: 'manage_custom_domain',
    group: 'company',
    label: 'Manage custom domain',
    description: 'Add and verify a domain for client-facing share links.',
    grants: { owner: true, admin: false, member: false },
  },
  {
    key: 'manage_api_keys',
    group: 'company',
    label: 'Manage API keys',
    description: 'Mint and revoke API keys used by the connector ecosystem.',
    grants: { owner: true, admin: true, member: false },
  },
];

/**
 * Predicate for code-level gates. Use this everywhere you'd otherwise write
 * `role === 'owner'` so the canonical matrix above stays load-bearing.
 *
 * Partial grants count as truthy — the caller is responsible for the
 * sub-scope (e.g. members can `access_all_projects` *for projects they're
 * invited to* — that scoping is enforced separately at the row level).
 */
export function canRole(role: TeamRole | string | null | undefined, key: PermissionKey): boolean {
  if (!role) return false;
  const def = PERMISSION_MATRIX.find((p) => p.key === key);
  if (!def) return false;
  const grant = def.grants[role as TeamRole];
  if (grant === true) return true;
  if (grant === false || grant === undefined) return false;
  return true; // partial → permitted, with scope handled by the caller
}
