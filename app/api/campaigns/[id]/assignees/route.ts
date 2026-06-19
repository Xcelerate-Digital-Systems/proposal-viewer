// app/api/campaigns/[id]/assignees/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { getCompanyMarkupDefaults } from '@/lib/markup-notification-defaults';
import { authRateLimit } from '@/lib/rate-limit';

// GET — list current assignees for a project, plus all assignable team members.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/assignees');
    if (limited) return limited;


  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();

  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ data: assignees }, { data: members }] = await Promise.all([
    supabase
      .from('review_project_assignees')
      .select('team_member_id, created_at, stages, notify_comment, notify_reply, notify_resolve, notify_status, notify_new_version')
      .eq('review_project_id', params.id),
    supabase
      .from('team_members')
      .select('id, user_id, name, email, role')
      .eq('company_id', auth.companyId)
      .order('name'),
  ]);

  return NextResponse.json({
    assignees: assignees ?? [],
    members: members ?? [],
  });
}

// POST — add a team member to the project's assignee list.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/assignees');
    if (limited) return limited;


  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { team_member_id } = body;
  if (!team_member_id) {
    return NextResponse.json({ error: 'team_member_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify the candidate is in the same company.
  const { data: candidate } = await supabase
    .from('team_members')
    .select('id, company_id')
    .eq('id', team_member_id)
    .single();
  if (!candidate || candidate.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
  }

  // Seed the new row from the agency's markup notification defaults. We only
  // include these on INSERT — if a row already exists for this member (which
  // upsert turns into an UPDATE) we don't want to clobber whatever toggles
  // they previously chose, so check first.
  const { data: existingAssignee } = await supabase
    .from('review_project_assignees')
    .select('team_member_id')
    .eq('review_project_id', params.id)
    .eq('team_member_id', team_member_id)
    .maybeSingle();

  const seedPrefs = existingAssignee
    ? {}
    : await getCompanyMarkupDefaults(supabase, auth.companyId);

  const { error } = await supabase
    .from('review_project_assignees')
    .upsert(
      { review_project_id: params.id, team_member_id, ...seedPrefs },
      { onConflict: 'review_project_id,team_member_id' }
    );

  if (error) {
    console.error('[api/campaigns/[id]/assignees] POST:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH — toggle individual notification preferences for an assignee.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/assignees');
    if (limited) return limited;


  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { team_member_id, prefs } = body;
  if (!team_member_id || !prefs || typeof prefs !== 'object') {
    return NextResponse.json({ error: 'team_member_id and prefs required' }, { status: 400 });
  }

  const allowed = ['notify_comment', 'notify_reply', 'notify_resolve', 'notify_status', 'notify_new_version'];
  const update: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof prefs[key] === 'boolean') update[key] = prefs[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid prefs supplied' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('review_project_assignees')
    .update(update)
    .eq('review_project_id', params.id)
    .eq('team_member_id', team_member_id);

  if (error) {
    console.error('[api/campaigns/[id]/assignees] PATCH:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — remove a team member from the project's assignee list.
// Self-unassign is allowed; removing others requires being on the project.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/assignees');
    if (limited) return limited;


  const team_member_id = req.nextUrl.searchParams.get('team_member_id');
  if (!team_member_id) {
    return NextResponse.json({ error: 'team_member_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, company_id')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Look up the member's email before removing them, so we can clean up
  // their decision votes afterwards.
  const { data: member } = await supabase
    .from('team_members')
    .select('email')
    .eq('id', team_member_id)
    .single();

  const { error } = await supabase
    .from('review_project_assignees')
    .delete()
    .eq('review_project_id', params.id)
    .eq('team_member_id', team_member_id);

  if (error) {
    console.error('[api/campaigns/[id]/assignees] DELETE:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Clear any decision votes the removed assignee had cast on items in
  // this project, so approval counts stay accurate.
  if (member?.email) {
    const { data: projectItems } = await supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', params.id);
    const itemIds = (projectItems ?? []).map((i: { id: string }) => i.id);
    if (itemIds.length > 0) {
      await supabase
        .from('review_item_decisions')
        .delete()
        .in('review_item_id', itemIds)
        .eq('reviewer_email', member.email.trim().toLowerCase());
    }
  }

  return NextResponse.json({ success: true });
}
