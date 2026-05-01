// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isValidEmail } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  try {
    const { user_id, name, email, invite_token } = await req.json();

    if (!user_id || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if team member already exists. A single user can belong to
    // multiple companies, so any existing row is enough to short-circuit.
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ id: existing[0].id });
    }

    // Open signup is disabled — accounts only via invite.
    if (!invite_token) {
      return NextResponse.json(
        { error: 'Sign-up requires an invite. Ask your team owner to invite you.' },
        { status: 403 }
      );
    }

    const { data: invite } = await supabase
      .from('company_invites')
      .select('*')
      .eq('token', invite_token)
      .is('accepted_at', null)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id,
        name,
        email,
        role: invite.role,
        company_id: invite.company_id,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from('company_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}