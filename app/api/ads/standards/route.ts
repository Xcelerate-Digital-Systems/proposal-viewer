// app/api/ads/standards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/* ─── GET — fetch account-level standards ────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data } = await supabase
      .from('ad_account_standards')
      .select('*')
      .eq('company_id', auth.companyId)
      .single();

    return NextResponse.json({
      success: true,
      data: data || {
        company_id: auth.companyId,
        hook_rate_target: null,
        hold_rate_target: null,
        uctr_target: null,
      },
    });
  } catch (err) {
    console.error('Ad standards GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── PUT — upsert account-level standards ───────────────────────────────── */

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    const standards = {
      company_id: auth.companyId,
      hook_rate_target: body.hook_rate_target ?? null,
      hold_rate_target: body.hold_rate_target ?? null,
      uctr_target: body.uctr_target ?? null,
      updated_at: new Date().toISOString(),
    };

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_account_standards')
      .upsert(standards, { onConflict: 'company_id' })
      .select()
      .single();

    if (error) {
      console.error('Ad standards upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Ad standards PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
