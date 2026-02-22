// app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

// POST - Create a new invite
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    // Only owners and admins can invite (or super admins viewing any company)
    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can send invites' }, { status: 403 });
    }

    const { email, role = 'member' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or member' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if this email already has a team member in this company
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('company_id', companyId)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'This person is already a team member' }, { status: 400 });
    }

    // Check if there's already a pending invite for this email
    const { data: existingInvite } = await supabase
      .from('company_invites')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'A pending invite already exists for this email' }, { status: 400 });
    }

    // Get company name for the response
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // Create the invite
    const { data: invite, error } = await supabase
      .from('company_invites')
      .insert({
        company_id: companyId,
        email: email.toLowerCase(),
        role,
        invited_by: member.id,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build invite URL
    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${baseUrl}/login?invite=${invite.token}`;

    return NextResponse.json({
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      expires_at: invite.expires_at,
      invite_url: inviteUrl,
      company_name: company?.name || 'Unknown',
    });
  } catch (err) {
    console.error('Create invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - List invites for the current (or overridden) company
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    // Only owners and admins can view invites (or super admins)
    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can view invites' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const { data: invites, error } = await supabase
      .from('company_invites')
      .select('*, invited_by_member:invited_by(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites });
  } catch (err) {
    console.error('List invites error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}