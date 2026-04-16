// app/api/ads/swipe/files/[id]/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Transcription not configured' }, { status: 503 });

    const supabase = createServiceClient();

    const { data: file, error: fetchErr } = await supabase
      .from('swipe_files')
      .select('id, media_type, media_url')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchErr || !file) return NextResponse.json({ error: 'Swipe file not found' }, { status: 404 });
    if (file.media_type !== 'video') return NextResponse.json({ error: 'Only video swipes can be transcribed' }, { status: 400 });
    if (!file.media_url) return NextResponse.json({ error: 'No video file attached' }, { status: 400 });

    const videoRes = await fetch(file.media_url);
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
    const videoFile = new File([videoBuffer], `video.${ext}`, {
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
      .eq('company_id', auth.companyId)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Failed to save transcription' }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
