// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const { user_id, name, email, company_id } = await req.json();

    if (!user_id || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if team member already exists
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json({ id: existing.id });
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id,
        name,
        email,
        company_id: company_id || DEFAULT_COMPANY_ID,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}