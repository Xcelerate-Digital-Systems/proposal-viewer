// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // The user must already be authenticated against Supabase Auth (signUp
    // returns a session immediately for email/password). Trust the verified
    // identity, never the body — otherwise an attacker with a leaked invite
    // token could attach their own auth user to a victim's company.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, invite_token } = await req.json().catch(() => ({}));
    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userId = user.id;
    const email = user.email.toLowerCase();

    const supabase = createServiceClient();

    // Check if team member already exists. A single user can belong to
    // multiple companies, so any existing row is enough to short-circuit.
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ id: existing[0].id });
    }

    // Open signup is disabled — accounts only via invite.
    if (!invite_token) {
      return NextResponse.json(
        { error: 'Sign-up requires an invite. Ask your team owner to invite you.' },
        { status: 403 },
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

    if (invite.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
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
