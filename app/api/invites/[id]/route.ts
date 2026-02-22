// app/api/invites/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

// DELETE - Revoke an invite
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

    // Only owners and admins can revoke (or super admins)
    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can revoke invites' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('company_invites')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}