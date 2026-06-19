// app/api/onboarding/complete/route.ts
//
// POST /api/onboarding/complete
// Flips the active company's onboarding_completed_at so AuthGuard stops
// routing the user back to the wizard. Idempotent — calling it a second
// time is a no-op (it only sets the timestamp when it's still null).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'onboarding/complete');
    if (limited) return limited;


    const { member, companyId } = auth;
    if (!member.is_super_admin && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the owner or an admin can complete onboarding.' },
        { status: 403 },
      );
    }

    const supabase = createServiceClient();
    const { data: company, error } = await supabase
      .from('companies')
      .update({
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .is('onboarding_completed_at', null)
      .select('id, onboarding_completed_at')
      .maybeSingle();

    if (error) {
      console.error('[api/onboarding/complete] POST:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // If the row was already completed previously, the WHERE clause matches
    // zero rows — fetch the existing value so the response is uniform.
    if (!company) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id, onboarding_completed_at')
        .eq('id', companyId)
        .single();
      return NextResponse.json(existing ?? { ok: true });
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error('onboarding/complete fatal:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
