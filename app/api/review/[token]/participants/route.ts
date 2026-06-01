// Public-reviewer participants list for the @mention autocomplete. Resolves
// the project from the share_token (or item-level share_token), then returns
// the same Participant shape as the admin route. CORS-open because the
// markup widget can be embedded on third-party domains.
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getProjectParticipants } from '@/lib/feedback/participants';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  try {
    const params = await props.params;
    const supabase = createServiceClient();

    // The token can match either a review_projects.share_token (project-level
    // share) or a review_items.share_token (single-item share). Try project
    // first; fall back to item → project.
    let projectId: string | null = null;

    const { data: project } = await supabase
      .from('review_projects')
      .select('id')
      .eq('share_token', params.token)
      .maybeSingle();
    if (project) {
      projectId = project.id;
    } else {
      const { data: item } = await supabase
        .from('review_items')
        .select('review_project_id')
        .eq('share_token', params.token)
        .maybeSingle();
      if (item) projectId = item.review_project_id;
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS });
    }

    // Guest reviewers identify themselves by an email typed into the
    // onboarding modal; the client can pass it back so the dropdown doesn't
    // suggest "@yourself". Trusted only for filtering, never for auth.
    const excludeEmail = req.nextUrl.searchParams.get('exclude_email');

    const participants = await getProjectParticipants(supabase, projectId, {
      excludeEmail: excludeEmail || null,
    });

    return NextResponse.json({ participants }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[api/review/[token]/participants] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
