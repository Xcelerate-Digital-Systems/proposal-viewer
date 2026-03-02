// app/api/team/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

// PATCH - Update a team member's role, name, or avatar
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;
    const { id } = await params;
    const body = await req.json();

    const supabase = createServiceClient();

    // Verify target is in the effective company
    const { data: target } = await supabase
      .from('team_members')
      .select('id, company_id, role')
      .eq('id', id)
      .single();

    if (!target || target.company_id !== companyId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // ── Role update ──────────────────────────────────────────
    if ('role' in body) {
      // Only owners or super admins can change roles
      if (!member.is_super_admin && member.role !== 'owner') {
        return NextResponse.json({ error: 'Only owners can change roles' }, { status: 403 });
      }

      if (id === member.id) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
      }

      const { role } = body;

      if (!['owner', 'admin', 'member'].includes(role)) {
        return NextResponse.json({ error: 'Role must be owner, admin, or member' }, { status: 400 });
      }

      // Only super admins can demote existing owners
      if (target.role === 'owner' && !member.is_super_admin) {
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
    }

    // ── Profile update (name / avatar_path) ──────────────────
    const hasProfileUpdate = 'name' in body || 'avatar_path' in body;

    if (hasProfileUpdate) {
      // Self-update: any authenticated user can update their own profile
      const isSelfUpdate = id === member.id;

      if (!isSelfUpdate) {
        // Other-member update: only super admins, owners, or admins
        const canEditOthers =
          member.is_super_admin ||
          member.role === 'owner' ||
          member.role === 'admin';

        if (!canEditOthers) {
          return NextResponse.json(
            { error: 'Only admins, owners, or super admins can edit other members' },
            { status: 403 }
          );
        }

        // Admins can only edit members, not owners or other admins
        if (
          member.role === 'admin' &&
          !member.is_super_admin &&
          (target.role === 'owner' || target.role === 'admin')
        ) {
          return NextResponse.json(
            { error: 'Admins can only edit members' },
            { status: 403 }
          );
        }
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if ('name' in body) {
        const name = String(body.name).trim();
        if (!name) {
          return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
        }
        updates.name = name;
      }

      if ('avatar_path' in body) {
        // avatar_path can be null (to remove) or a string path
        updates.avatar_path = body.avatar_path;
      }

      const { error } = await supabase
        .from('team_members')
        .update(updates)
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
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
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    // Only owners, admins, or super admins can remove members
    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
    }

    const { id } = await params;

    // Can't remove yourself
    if (id === member.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify target is in the effective company and not owner
    const { data: target } = await supabase
      .from('team_members')
      .select('id, company_id, role, user_id')
      .eq('id', id)
      .single();

    if (!target || target.company_id !== companyId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 });
    }

    // Admins can only remove members, not other admins (super admins can remove anyone except owner)
    if (!member.is_super_admin && member.role === 'admin' && target.role === 'admin') {
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