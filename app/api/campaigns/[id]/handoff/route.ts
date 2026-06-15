import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/campaigns/[id]/handoff
 *
 * Generates a handoff share token for the campaign (or returns the existing one).
 * Only available when the campaign status is approved or archived.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await authRateLimit(auth.companyId, 'campaigns/handoff');
  if (limited) return limited;

  const supabase = createServiceClient();

  const { data: project, error } = await supabase
    .from('review_projects')
    .select('id, company_id, status, handoff_share_token')
    .eq('id', params.id)
    .eq('company_id', auth.companyId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (project.status !== 'approved' && project.status !== 'archived') {
    return NextResponse.json(
      { error: 'Handoff is only available for approved or archived campaigns' },
      { status: 400 },
    );
  }

  if (project.handoff_share_token) {
    return NextResponse.json({ token: project.handoff_share_token });
  }

  const token = crypto.randomUUID().replace(/-/g, '');

  const { error: updateError } = await supabase
    .from('review_projects')
    .update({ handoff_share_token: token })
    .eq('id', project.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to generate handoff link' }, { status: 500 });
  }

  return NextResponse.json({ token });
}

/**
 * DELETE /api/campaigns/[id]/handoff
 *
 * Revokes the handoff share token, disabling the public link.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('review_projects')
    .update({ handoff_share_token: null })
    .eq('id', params.id)
    .eq('company_id', auth.companyId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke handoff link' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
