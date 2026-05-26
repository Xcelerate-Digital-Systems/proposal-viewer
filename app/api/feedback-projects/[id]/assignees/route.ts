// app/api/feedback-projects/[id]/assignees/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

// GET — list current assignees for a project, plus all assignable team members.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      .select('team_member_id, created_at, notify_comment, notify_reply, notify_resolve, notify_status, notify_new_version')
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

  const { team_member_id } = await req.json();
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

  const { error } = await supabase
    .from('review_project_assignees')
    .upsert(
      { review_project_id: params.id, team_member_id },
      { onConflict: 'review_project_id,team_member_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH — toggle individual notification preferences for an assignee.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { team_member_id, prefs } = await req.json();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — remove a team member from the project's assignee list.
// Self-unassign is allowed; removing others requires being on the project.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const { error } = await supabase
    .from('review_project_assignees')
    .delete()
    .eq('review_project_id', params.id)
    .eq('team_member_id', team_member_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
