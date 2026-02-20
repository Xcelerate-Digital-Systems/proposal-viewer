// app/api/invites/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET - Validate an invite token (public endpoint)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: invite } = await supabase
      .from('company_invites')
      .select('id, email, role, expires_at, accepted_at, company:company_id(name)')
      .eq('token', token)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }

    const companyName = (invite.company as any)?.name || 'Unknown';

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      company_name: companyName,
      expires_at: invite.expires_at,
    });
  } catch (err) {
    console.error('Validate invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}