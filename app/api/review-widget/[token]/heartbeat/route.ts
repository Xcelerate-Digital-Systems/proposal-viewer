// app/api/review-widget/[token]/heartbeat/route.ts
//
// Fires once when the widget script initialises on a page. Marks the
// project's `script_installed_at` the first time it succeeds so the admin
// setup wizard can advance from "waiting for install" → "add first page".
// Also backfills `widget_installed_at` on every webpage item in the project,
// since all items live under the same root_domain and therefore share the
// same install.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { data: project } = await supabaseAdmin
      .from('review_projects')
      .select('id, script_installed_at, status')
      .eq('share_token', params.token)
      .single();

    if (!project || project.status === 'archived') {
      return NextResponse.json({ ok: false }, { status: 404, headers: CORS_HEADERS });
    }

    const now = new Date().toISOString();

    if (!project.script_installed_at) {
      await supabaseAdmin
        .from('review_projects')
        .update({ script_installed_at: now })
        .eq('id', project.id);
    }

    await supabaseAdmin
      .from('review_items')
      .update({ widget_installed_at: now })
      .eq('review_project_id', project.id)
      .eq('type', 'webpage')
      .is('widget_installed_at', null);

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
}
