// app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { isValidEmail } from '@/lib/sanitize';
import { sendInviteEmail } from '@/lib/auth-emails';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';
import { rateLimit } from '@/lib/rate-limit';

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

    // Rate limit: 10 invites per minute per company
    const rl = await rateLimit({ key: `invite:create:${companyId}`, limit: 10, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email, role = 'member' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Role must be owner, admin, or member' }, { status: 400 });
    }

    // Only owners and super admins can invite as owner
    if (role === 'owner' && !member.is_super_admin && member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can invite new owners' }, { status: 403 });
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

    // Seat-limit check counts current team members + pending invites. Runs
    // after the dup checks above so retrying with the same email never gets
    // a confusing "limit reached" message when the real issue is the dup.
    const limitCheck = await checkResourceLimit(companyId, 'seats');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'seats'), { status: 402 });
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

    // Build invite URL — never trust the Origin header for email links (phishing risk)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${baseUrl}/login?invite=${invite.token}`;
    const companyName = company?.name || 'AgencyViz';

    // Send invite email (best-effort — surfaces failure but the invite row still exists)
    let emailSent = true;
    let emailError: string | null = null;
    try {
      await sendInviteEmail({
        to: invite.email,
        companyName,
        inviterName: member.name,
        role: invite.role,
        inviteUrl,
        expiresAt: invite.expires_at,
      });
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : 'Unknown email error';
      console.error('Failed to send invite email:', err);
    }

    return NextResponse.json({
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      expires_at: invite.expires_at,
      invite_url: inviteUrl,
      company_name: companyName,
      email_sent: emailSent,
      email_error: emailError,
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