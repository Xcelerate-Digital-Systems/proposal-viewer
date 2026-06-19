// app/api/review-widget/[token]/heartbeat/route.ts
//
// Fires once when the widget script initialises on a page. Marks the
// project's `script_installed_at` the first time it succeeds so the admin
// setup wizard can advance from "waiting for install" → "add first page".
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest } from '@/lib/rate-limit';

// Wildcard origin is intentional — the review widget is embedded on arbitrary customer domains.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const rl = await rateLimit({ key: `pub-heartbeat:${ipFromRequest(_req)}`, limit: 120, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ ok: false }, { status: 429, headers: CORS_HEADERS });
  }

  const supabase = createServiceClient();
  try {
    const { data: project } = await supabase
      .from('review_projects')
      .select('id, script_installed_at, status')
      .eq('share_token', params.token)
      .single();

    if (!project || project.status === 'archived') {
      return NextResponse.json({ ok: false }, { status: 404, headers: CORS_HEADERS });
    }

    const now = new Date().toISOString();

    if (!project.script_installed_at) {
      await supabase
        .from('review_projects')
        .update({ script_installed_at: now })
        .eq('id', project.id);
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
}
