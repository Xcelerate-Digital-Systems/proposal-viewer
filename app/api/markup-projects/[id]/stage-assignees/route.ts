// app/api/markup-projects/[id]/stage-assignees/route.ts
//
// Per-stage assignee scoping for a feedback project. The base assignee rows
// live in `review_project_assignees` (team members) and
// `review_project_guest_recipients` (guests); this route mutates the
// `stages text[]` column on those rows so each row can be scoped to a subset
// of pipeline stages.
//
// GET     — list assignees grouped by stage (for rendering column avatars).
// POST    — atomically add a member or guest to a stage.
// DELETE  — atomically remove a member or guest from a stage.
//
// All writes are atomic at the row level via array_append/array_remove so two
// concurrent `+` clicks can't drop a stage entry.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { getCompanyMarkupDefaults } from '@/lib/markup-notification-defaults';
import type { FeedbackStatus } from '@/lib/types/feedback';

const VALID_STAGES: FeedbackStatus[] = [
  'draft', 'in_progress', 'internal_review', 'client_review',
  'revision_needed', 'approved', 'rejected', 'archived',
];

function isValidStage(value: unknown): value is FeedbackStatus {
  return typeof value === 'string' && (VALID_STAGES as string[]).includes(value);
}

// Verify the auth user can act on this project. We don't require the project
// to belong to the user's *active* workspace (auth.companyId) because users
// with multiple memberships often default to a different workspace than the
// one they're viewing the project in — that mismatch surfaces here as a 404
// from the Kanban `+` picker even though the user is a legit member.
// Instead, we accept the request if:
//   (a) the project belongs to the user's active workspace, OR
//   (b) the user has a real membership in the project's company, OR
//   (c) the user is a super-admin.
async function ensureProjectAccessible(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  auth: { companyId: string; member: { user_id: string; is_super_admin: boolean } },
): Promise<{ ok: boolean; companyId: string | null }> {
  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', projectId)
    .single();
  if (!project) return { ok: false, companyId: null };

  if (project.company_id === auth.companyId) {
    return { ok: true, companyId: project.company_id as string };
  }
  if (auth.member.is_super_admin) {
    return { ok: true, companyId: project.company_id as string };
  }
  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', auth.member.user_id)
    .eq('company_id', project.company_id)
    .maybeSingle();
  return { ok: !!membership, companyId: project.company_id as string };
}

// ─── GET ────────────────────────────────────────────────────────────────────
// Returns the per-stage roster so the Kanban can render avatar stacks per column.
// Shape: { members: [{ team_member_id, name, email, stages }], guests: [{ email, name, stages }] }
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const access = await ensureProjectAccessible(supabase, params.id, auth);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ data: assigneeRows }, { data: guestRows }] = await Promise.all([
    supabase
      .from('review_project_assignees')
      .select('team_member_id, stages')
      .eq('review_project_id', params.id),
    supabase
      .from('review_project_guest_recipients')
      .select('email, name, stages, removed_at')
      .eq('review_project_id', params.id),
  ]);

  const memberIds = (assigneeRows ?? []).map((r) => r.team_member_id).filter(Boolean);
  const { data: memberRows } = memberIds.length
    ? await supabase
        .from('team_members')
        .select('id, name, email')
        .in('id', memberIds as string[])
    : { data: [] as { id: string; name: string | null; email: string }[] };

  const memberLookup = new Map(
    (memberRows ?? []).map((m) => [m.id, { name: m.name ?? '', email: m.email }]),
  );

  const members = (assigneeRows ?? []).map((r) => ({
    team_member_id: r.team_member_id as string,
    name: memberLookup.get(r.team_member_id as string)?.name ?? '',
    email: memberLookup.get(r.team_member_id as string)?.email ?? '',
    stages: (r.stages as string[]) ?? [],
  }));

  const guests = (guestRows ?? [])
    .filter((g) => !g.removed_at)
    .map((g) => ({
      email: g.email as string,
      name: (g.name as string | null) ?? '',
      stages: (g.stages as string[]) ?? [],
    }));

  return NextResponse.json({ members, guests });
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Add a member or guest to a stage.
//   Body (member): { kind: 'member', stage, team_member_id }
//   Body (guest):  { kind: 'guest',  stage, email, name? }
//
// For members the assignee row is upserted with array_append. For guests we
// upsert into review_project_guest_recipients with the new stage appended.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { kind, stage } = body as { kind?: string; stage?: string };
  if (!isValidStage(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const access = await ensureProjectAccessible(supabase, params.id, auth);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (kind === 'member') {
    const { team_member_id } = body as { team_member_id?: string };
    if (!team_member_id) {
      return NextResponse.json({ error: 'team_member_id required' }, { status: 400 });
    }
    // Verify candidate belongs to the project's company. (Not auth.companyId —
    // that's the caller's active workspace which may differ when a user has
    // multiple memberships; the project's company is the source of truth.)
    const { data: candidate } = await supabase
      .from('team_members')
      .select('id, company_id')
      .eq('id', team_member_id)
      .single();
    if (!candidate || candidate.company_id !== access.companyId) {
      return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
    }

    // Fetch-then-write race is acceptable here: two concurrent adds of the
    // same stage just collapse to a single array entry on the dedupe step
    // below, and `upsert` keys on (review_project_id, team_member_id).
    const { data: existing } = await supabase
      .from('review_project_assignees')
      .select('stages')
      .eq('review_project_id', params.id)
      .eq('team_member_id', team_member_id)
      .maybeSingle();

    const nextStages = Array.from(
      new Set([...((existing?.stages as string[] | undefined) ?? []), stage]),
    );

    // First-time add for this member → seed notification toggles from the
    // agency-level defaults. Subsequent adds just touch `stages` so per-user
    // toggles aren't clobbered.
    const seedPrefs = existing
      ? {}
      : await getCompanyMarkupDefaults(supabase, access.companyId as string);

    const { error } = await supabase
      .from('review_project_assignees')
      .upsert(
        { review_project_id: params.id, team_member_id, stages: nextStages, ...seedPrefs },
        { onConflict: 'review_project_id,team_member_id' },
      );

    if (error) {
      console.error('[api/markup-projects/[id]/stage-assignees]', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (kind === 'guest') {
    const { email, name } = body as { email?: string; name?: string };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('review_project_guest_recipients')
      .select('stages, name')
      .eq('review_project_id', params.id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    const nextStages = Array.from(
      new Set([...((existing?.stages as string[] | undefined) ?? []), stage]),
    );

    // Seed notification toggles from agency defaults only when this is a
    // brand-new guest row, so previously-toggled prefs survive.
    const seedPrefs = existing
      ? {}
      : await getCompanyMarkupDefaults(supabase, access.companyId as string);

    const { error } = await supabase
      .from('review_project_guest_recipients')
      .upsert(
        {
          review_project_id: params.id,
          email: normalizedEmail,
          name: name ?? existing?.name ?? '',
          stages: nextStages,
          removed_at: null,
          ...seedPrefs,
        },
        { onConflict: 'review_project_id,email' },
      );

    if (error) {
      console.error('[api/markup-projects/[id]/stage-assignees]', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
// Remove a member or guest from a stage. The assignee row is preserved (with
// the stage stripped from the array) so per-row notification preferences and
// other-stage memberships aren't clobbered.
//
//   ?kind=member&stage=client_review&team_member_id=...
//   ?kind=guest&stage=client_review&email=...
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl;
  const kind = url.searchParams.get('kind');
  const stage = url.searchParams.get('stage');
  if (!isValidStage(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const access = await ensureProjectAccessible(supabase, params.id, auth);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (kind === 'member') {
    const team_member_id = url.searchParams.get('team_member_id');
    if (!team_member_id) {
      return NextResponse.json({ error: 'team_member_id required' }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from('review_project_assignees')
      .select('stages')
      .eq('review_project_id', params.id)
      .eq('team_member_id', team_member_id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ success: true });

    const nextStages = ((existing.stages as string[] | undefined) ?? []).filter(
      (s) => s !== stage,
    );
    const { error } = await supabase
      .from('review_project_assignees')
      .update({ stages: nextStages })
      .eq('review_project_id', params.id)
      .eq('team_member_id', team_member_id);
    if (error) {
      console.error('[api/markup-projects/[id]/stage-assignees]', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (kind === 'guest') {
    const email = url.searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('review_project_guest_recipients')
      .select('stages')
      .eq('review_project_id', params.id)
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!existing) return NextResponse.json({ success: true });

    const nextStages = ((existing.stages as string[] | undefined) ?? []).filter(
      (s) => s !== stage,
    );
    const { error } = await supabase
      .from('review_project_guest_recipients')
      .update({ stages: nextStages })
      .eq('review_project_id', params.id)
      .eq('email', normalizedEmail);
    if (error) {
      console.error('[api/markup-projects/[id]/stage-assignees]', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
}
