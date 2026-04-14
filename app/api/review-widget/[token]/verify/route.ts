// app/api/review-widget/[token]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

// 1x1 transparent GIF — legacy fallback for <Image>-style beacons
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function pixel() {
  return new NextResponse(PIXEL, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'image/gif' },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const itemId = req.nextUrl.searchParams.get('item');
  const wantsJson = req.nextUrl.searchParams.get('format') === 'json'
    || (req.headers.get('accept') || '').includes('application/json');

  if (!itemId) return pixel();

  try {
    const { data: project } = await supabaseAdmin
      .from('review_projects')
      .select('id')
      .eq('share_token', params.token)
      .single();

    if (!project) return pixel();

    const { data: item } = await supabaseAdmin
      .from('review_items')
      .select('id, widget_installed_at, screenshot_url')
      .eq('id', itemId)
      .eq('review_project_id', project.id)
      .eq('type', 'webpage')
      .single();

    if (!item) return pixel();

    // Mark installed if not yet marked
    if (!item.widget_installed_at) {
      await supabaseAdmin
        .from('review_items')
        .update({ widget_installed_at: new Date().toISOString() })
        .eq('id', item.id);
    }

    if (!wantsJson) return pixel();

    return NextResponse.json(
      {
        installed: true,
        needs_screenshot: !item.screenshot_url,
      },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch {
    return pixel();
  }
}
