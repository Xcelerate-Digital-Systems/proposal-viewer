// app/api/review-widget/[token]/screenshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient();
  try {
    const body = await req.json();
    const { item: itemId, image } = body as { item?: string; image?: string };

    if (!itemId || !image) {
      return NextResponse.json(
        { error: 'Missing item or image' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate project
    const { data: project } = await supabase
      .from('review_projects')
      .select('id')
      .eq('share_token', params.token)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Validate item belongs to project
    const { data: item } = await supabase
      .from('review_items')
      .select('id')
      .eq('id', itemId)
      .eq('review_project_id', project.id)
      .single();

    if (!item) {
      return NextResponse.json(
        { error: 'Invalid item' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Decode base64 image
    // Expect format: "data:image/png;base64,iVBOR..." or just the raw base64
    let base64Data = image;
    let mimeType = 'image/png';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        return NextResponse.json(
          { error: 'Invalid image format' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Max 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large (max 10MB)' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `${project.id}/${itemId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('review-screenshots')
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Screenshot upload error:', uploadError);
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('review-screenshots')
      .getPublicUrl(filename);

    return NextResponse.json(
      { url: urlData.publicUrl },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('Screenshot route error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}