// app/api/team/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

async function getAuthenticatedMember(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return member;
}

// PATCH - Update a team member's role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 });
    }

    const { id } = await params;
    const { role } = await req.json();

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or member' }, { status: 400 });
    }

    // Can't change own role
    if (id === member.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify target is in same company
    const { data: target } = await supabase
      .from('team_members')
      .select('id, company_id, role')
      .eq('id', id)
      .single();

    if (!target || target.company_id !== member.company_id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    const { error } = await supabase
      .from('team_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a team member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
    }

    const { id } = await params;

    // Can't remove yourself
    if (id === member.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify target is in same company and not owner
    const { data: target } = await supabase
      .from('team_members')
      .select('id, company_id, role, user_id')
      .eq('id', id)
      .single();

    if (!target || target.company_id !== member.company_id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 });
    }

    // Admins can only remove members, not other admins
    if (member.role === 'admin' && target.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot remove other admins' }, { status: 403 });
    }

    // Delete team member row
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}