// app/api/ads/swipe/files/[id]/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { fetchAccessibleFile } from '@/lib/swipe-files/access';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { isValidWebhookUrl } from '@/lib/sanitize';
import OpenAI, { toFile } from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await rateLimit({ key: `transcribe:${auth.companyId}`, limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many transcription requests' }, {
        status: 429,
        headers: rateLimitHeaders(rl, 5),
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Transcription not configured' }, { status: 503 });

    const supabase = createServiceClient();

    const access = await fetchAccessibleFile(supabase, params.id, auth.companyId);
    if (!access) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });
    const file = access.file;
    if (file.media_type !== 'video') return NextResponse.json({ error: 'Only video swipes can be transcribed' }, { status: 400 });
    if (!file.media_url) return NextResponse.json({ error: 'No video file attached' }, { status: 400 });
    if (!isValidWebhookUrl(file.media_url)) return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });

    const videoRes = await fetch(file.media_url, { redirect: 'manual' });
    if (!videoRes.ok) return NextResponse.json({ error: 'Failed to download video' }, { status: 502 });

    const contentLength = Number(videoRes.headers.get('content-length') || 0);
    if (contentLength > MAX_WHISPER_BYTES) {
      return NextResponse.json(
        { error: 'Video is too large for auto-transcription (max 25MB). You can paste the transcript manually.' },
        { status: 413 },
      );
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    if (videoBuffer.byteLength > MAX_WHISPER_BYTES) {
      return NextResponse.json(
        { error: 'Video is too large for auto-transcription (max 25MB). You can paste the transcript manually.' },
        { status: 413 },
      );
    }

    const ext = file.media_url.match(/\.(mp4|mov|webm|m4a)/i)?.[1] || 'mp4';
    const videoFile = await toFile(videoBuffer, `video.${ext}`, {
      type: ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4',
    });

    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: videoFile,
    });

    const { data, error } = await supabase
      .from('swipe_files')
      .update({ transcription: result.text, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Failed to save transcription' }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json({ error: 'Transcription failed. Please try again.' }, { status: 500 });
  }
}
