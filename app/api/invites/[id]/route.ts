// app/api/invites/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { sendInviteEmail } from '@/lib/auth-emails';
import { rateLimit } from '@/lib/rate-limit';

// DELETE - Revoke a pending invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can revoke invites' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: invite } = await supabase
      .from('company_invites')
      .select('id, company_id')
      .eq('id', id)
      .single();

    if (!invite || invite.company_id !== companyId) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('company_invites')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Revoke invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Resend an invite email (also refreshes the 7-day expiry)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can resend invites' }, { status: 403 });
    }

    // Rate limit: 5 resends per minute per company
    const rl = await rateLimit({ key: `invite:resend:${companyId}`, limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: invite } = await supabase
      .from('company_invites')
      .select('id, email, role, token, company_id, accepted_at')
      .eq('id', id)
      .single();

    if (!invite || invite.company_id !== companyId) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite has already been accepted' }, { status: 400 });
    }

    // Refresh expiry to give the recipient a full window from "resend" time
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await supabase
      .from('company_invites')
      .update({ expires_at: newExpiresAt })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // Never trust Origin header for email links (phishing risk)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${baseUrl}/login?invite=${invite.token}`;

    try {
      await sendInviteEmail({
        to: invite.email,
        companyName: company?.name || 'AgencyViz',
        inviterName: member.name,
        role: invite.role,
        inviteUrl,
        expiresAt: newExpiresAt,
      });
    } catch (err) {
      console.error('Failed to resend invite email:', err);
      return NextResponse.json({
        error: 'Invite expiry was refreshed but email delivery failed',
        invite_url: inviteUrl,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: invite.email,
      expires_at: newExpiresAt,
      invite_url: inviteUrl,
    });
  } catch (err) {
    console.error('Resend invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
