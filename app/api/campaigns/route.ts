import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const companyId = auth.companyId;

    const limitCheck = await checkResourceLimit(companyId, 'reviews');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'reviews'), { status: 402 });
    }

    const supabase = createServiceClient();

    const { data: created, error } = await supabase
      .from('review_projects')
      .insert({
        company_id: companyId,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        client_company: typeof body.client_company === 'string' ? body.client_company.trim() || null : null,
        client_name: typeof body.client_name === 'string' ? body.client_name.trim() || null : null,
        client_email: typeof body.client_email === 'string' ? body.client_email.trim() || null : null,
        created_by: auth.member.user_id ?? null,
      })
      .select('id')
      .single();

    if (error || !created) {
      console.error('[api/campaigns] POST:', error?.message);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    if (auth.member.user_id) {
      const { data: tm } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', auth.member.user_id)
        .eq('company_id', companyId)
        .maybeSingle();
      if (tm?.id) {
        await supabase
          .from('review_project_assignees')
          .upsert(
            { review_project_id: created.id, team_member_id: tm.id },
            { onConflict: 'review_project_id,team_member_id' },
          );
      }
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (err) {
    console.error('[api/campaigns] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
