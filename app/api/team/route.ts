// app/api/team/route.ts
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

// GET - List team members for the current company
export async function GET(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: members, error } = await supabase
      .from('team_members')
      .select('id, name, email, role, created_at')
      .eq('company_id', member.company_id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('id', member.company_id)
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