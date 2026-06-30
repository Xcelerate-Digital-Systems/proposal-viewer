// app/api/team/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

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

    const limited = await authRateLimit(auth.companyId, 'team/[id]');
    if (limited) return limited;

    const { member, companyId } = auth;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

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
        console.error('[api/team/[id]] PATCH role:', error.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Profile update (name / avatar_path / markup_notify_*) ─
    const MARKUP_PREF_KEYS = [
      'markup_notify_comment', 'markup_notify_reply', 'markup_notify_resolve',
      'markup_notify_status', 'markup_notify_new_version',
    ] as const;
    const hasMarkupPrefs = MARKUP_PREF_KEYS.some((k) => k in body);
    const hasProfileUpdate = 'name' in body || 'avatar_path' in body || hasMarkupPrefs;

    if (hasProfileUpdate) {
      const isSelfUpdate = id === member.id;

      if (!isSelfUpdate) {
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

        if (
          member.role === 'admin' &&
          !member.is_super_admin &&
          target.role === 'owner'
        ) {
          return NextResponse.json(
            { error: 'Admins cannot edit the owner' },
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
        updates.avatar_path = body.avatar_path;
      }

      for (const key of MARKUP_PREF_KEYS) {
        if (key in body) {
          updates[key] = typeof body[key] === 'boolean' ? body[key] : null;
        }
      }

      const { error } = await supabase
        .from('team_members')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('[api/team/[id]] PATCH profile:', error.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const limited = await authRateLimit(auth.companyId, 'team/[id]');
    if (limited) return limited;

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

    // Remove campaign assignee rows first so FK constraints don't block
    // the team_members delete.
    await supabase
      .from('review_project_assignees')
      .delete()
      .eq('team_member_id', id);

    // Delete team member row
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[api/team/[id]] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}