// app/swipe/[token]/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /swipe/[token]/raw
 *
 * Returns a plain-text summary of a swipe file — designed to be pasted or
 * shared directly with AI tools. Same token as the human share link, so one
 * URL works for designers (/swipe/[token]) and another for AI (/swipe/[token]/raw).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  const { data: file } = await supabase
    .from('swipe_files')
    .select('*')
    .eq('share_token', params.token)
    .maybeSingle();

  if (!file) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: type } = await supabase
    .from('swipe_types')
    .select('name')
    .eq('id', file.type_id)
    .maybeSingle();

  const lines: string[] = [];
  lines.push(`Title: ${file.title}`);
  if (type?.name) lines.push(`Type: ${type.name}`);
  if (file.brand) lines.push(`Brand: ${file.brand}`);
  if (file.headline) lines.push(`Headline: ${file.headline}`);
  if (file.primary_text) lines.push(`Primary text: ${file.primary_text}`);
  if (file.description) lines.push(`Description: ${file.description}`);
  if (file.cta) lines.push(`CTA: ${file.cta}`);
  if (file.notes) lines.push(`Notes: ${file.notes}`);
  if (file.tags?.length) lines.push(`Tags: ${file.tags.join(', ')}`);
  if (file.source_url) lines.push(`Source URL: ${file.source_url}`);
  if (file.media_url) {
    lines.push(`Media type: ${file.media_type || 'unknown'}`);
    lines.push(`Media URL: ${file.media_url}`);
  }
  lines.push(`Created: ${file.created_at}`);

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
