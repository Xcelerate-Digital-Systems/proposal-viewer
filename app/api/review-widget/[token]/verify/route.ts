// app/api/review-widget/[token]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const itemId = req.nextUrl.searchParams.get('item');
  if (!itemId) {
    return new NextResponse(PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Fire-and-forget: mark as installed
  (async () => {
    try {
      const { data: project } = await supabaseAdmin
        .from('review_projects')
        .select('id')
        .eq('share_token', params.token)
        .single();

      if (!project) return;

      // Only update if not already installed
      await supabaseAdmin
        .from('review_items')
        .update({ widget_installed_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('review_project_id', project.id)
        .eq('type', 'webpage')
        .is('widget_installed_at', null);
    } catch {
      // Silently fail
    }
  })();

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}