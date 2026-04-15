// app/api/auth/claim-invite/route.ts
//
// Catches users who signed up via magic link (or any flow that bypasses
// /api/auth/register) and links them to a pending invite for their email.
// Idempotent: if they already have a team_members row, no-op.
//
// Authenticated by Supabase session token only — does NOT require a
// team_members row, since the whole point is to create one.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // If user already belongs to a team, do nothing.
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ claimed: false, reason: 'already_member' });
    }

    // Find a pending, non-expired invite for this email.
    const { data: invite } = await supabase
      .from('company_invites')
      .select('id, company_id, role, email, expires_at, accepted_at')
      .eq('email', user.email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ claimed: false, reason: 'no_pending_invite' });
    }

    const displayName =
      (user.user_metadata?.name as string | undefined)?.trim() ||
      user.email.split('@')[0];

    const { data: member, error: insertError } = await supabase
      .from('team_members')
      .insert({
        user_id: user.id,
        name: displayName,
        email: user.email.toLowerCase(),
        role: invite.role,
        company_id: invite.company_id,
      })
      .select('id, role, company_id')
      .single();

    if (insertError) {
      console.error('claim-invite insert failed:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase
      .from('company_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return NextResponse.json({ claimed: true, member });
  } catch (err) {
    console.error('claim-invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
