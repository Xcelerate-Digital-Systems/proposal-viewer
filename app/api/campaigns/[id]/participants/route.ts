// Admin-side participants list for the @mention autocomplete in the markup
// reviewer. Authenticates via Supabase session, scopes to the caller's
// company, and returns the same Participant shape as the public-token route.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { getProjectParticipants } from '@/lib/feedback/participants';
import { authRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'campaigns/participants');
    if (limited) return limited;


    const supabase = createServiceClient();

    const { data: project } = await supabase
      .from('review_projects')
      .select('id, company_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!project || project.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const participants = await getProjectParticipants(supabase, params.id, {
      excludeEmail: (auth.member as { email?: string | null })?.email ?? null,
    });

    return NextResponse.json({ participants });
  } catch (err) {
    console.error('[api/campaigns/[id]/participants] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
