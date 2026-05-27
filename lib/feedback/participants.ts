// Shared participant resolution for @mention autocomplete and for validating
// inbound mentions on the server. A participant is anyone who can legitimately
// be @-mentioned in a comment on a given review_project: every team member
// assigned to the project (and, as a fallback when no assignees are set, every
// team member of the owning company) plus every guest recipient invited to
// the project. The contract is the same shape across admin + public routes so
// the editor doesn't care which one populated its suggestion list.

import { createServiceClient } from '@/lib/supabase-server';

export type ParticipantKind = 'team' | 'guest';

export interface Participant {
  /** Stable id — team_member_id for team, lower-cased email for guests. */
  id: string;
  /** Display name shown in the dropdown and the mention pill. */
  name: string;
  /** Canonical email used as the notification routing key. */
  email: string;
  kind: ParticipantKind;
}

/**
 * Resolve the mentionable participants for a project. Returns a de-duped
 * list with team members first, then guests, sorted alphabetically inside
 * each group.
 *
 * The `excludeEmail` argument lets a caller filter out the viewer themselves
 * so the dropdown doesn't suggest "@you".
 */
export async function getProjectParticipants(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  options?: { excludeEmail?: string | null }
): Promise<Participant[]> {
  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) return [];

  const [{ data: assigneeRows }, { data: guestRows }] = await Promise.all([
    supabase
      .from('review_project_assignees')
      .select('team_member:team_members(id, name, email)')
      .eq('review_project_id', projectId),
    supabase
      .from('review_project_guest_recipients')
      .select('email, name')
      .eq('review_project_id', projectId),
  ]);

  type AssigneeRow = { team_member: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null };

  const teamSet = new Map<string, Participant>();
  for (const row of (assigneeRows ?? []) as unknown as AssigneeRow[]) {
    const rel = row.team_member;
    const tms = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const tm of tms) {
      const email = tm.email?.trim().toLowerCase();
      if (!email) continue;
      teamSet.set(email, {
        id: tm.id,
        name: (tm.name?.trim() || tm.email || '').trim(),
        email,
        kind: 'team',
      });
    }
  }

  // If no explicit assignees, fall back to every team member of the
  // owning company. Matches the existing /assignees endpoint shape where
  // "members" is the full pool.
  if (teamSet.size === 0) {
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name, email')
      .eq('company_id', project.company_id);
    for (const m of members ?? []) {
      const email = (m as { email: string | null }).email?.trim().toLowerCase();
      if (!email) continue;
      teamSet.set(email, {
        id: (m as { id: string }).id,
        name: ((m as { name: string | null }).name?.trim() || email).trim(),
        email,
        kind: 'team',
      });
    }
  }

  const guestSet = new Map<string, Participant>();
  for (const row of guestRows ?? []) {
    const email = (row as { email: string | null }).email?.trim().toLowerCase();
    if (!email) continue;
    // Skip guests that are actually team members — admin should see them on
    // the team side, and we want a single canonical participant per email.
    if (teamSet.has(email)) continue;
    guestSet.set(email, {
      id: email,
      name: ((row as { name: string | null }).name?.trim() || email).trim(),
      email,
      kind: 'guest',
    });
  }

  const exclude = options?.excludeEmail?.trim().toLowerCase() || null;
  if (exclude) {
    teamSet.delete(exclude);
    guestSet.delete(exclude);
  }

  const sortByName = (a: Participant, b: Participant) => a.name.localeCompare(b.name);
  return [...Array.from(teamSet.values()).sort(sortByName), ...Array.from(guestSet.values()).sort(sortByName)];
}
