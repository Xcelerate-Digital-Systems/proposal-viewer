import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { user_id, name, email } = await req.json();

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
      .insert({ user_id, name, email })
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