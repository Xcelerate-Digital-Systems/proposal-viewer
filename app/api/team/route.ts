// app/api/team/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

// GET - List team members for the current (or overridden) company
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;
    const supabase = createServiceClient();

    const { data: members, error } = await supabase
      .from('team_members')
      .select('id, name, email, role, created_at, markup_notify_comment, markup_notify_reply, markup_notify_resolve, markup_notify_status, markup_notify_new_version')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[api/team] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('id', companyId)
      .single();

    return NextResponse.json({
      members: members || [],
      company,
      current_member_id: member.id,
      current_role: member.role,
    });
  } catch (err) {
    console.error('List team error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}