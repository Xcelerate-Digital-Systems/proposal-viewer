// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { user_id, name, email, invite_token } = await req.json();

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

    // --- INVITE PATH ---
    if (invite_token) {
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

      // Create team member in the invited company
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

      // Mark invite as accepted
      await supabase
        .from('company_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      return NextResponse.json({ id: data.id });
    }

    // --- SELF-SERVICE PATH ---
    // Create a new company for the user
    const companyName = `${name}'s Company`;
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: companyName, slug: `${slug}-${Date.now()}` })
      .select('id')
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    // Create team member as owner of the new company
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id,
        name,
        email,
        role: 'owner',
        company_id: company.id,
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