// app/api/ads/swipe/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ads/swipe/files/upload
 *
 * Returns a signed upload URL so the client can upload large files
 * (up to 100MB) directly to Supabase Storage, bypassing the serverless
 * function body-size limit (~4.5MB on Vercel).
 *
 * Body (JSON):
 *   - filename: original filename (used for extension + sanity)
 *   - content_type: MIME type
 *   - company_id: for storage path scoping
 *   - swipe_id: optional — embed into the path for traceability
 *
 * Response:
 *   - path: storage path inside the bucket
 *   - token: one-time upload token (pass to supabase.storage.uploadToSignedUrl)
 *   - public_url: the eventual public URL once the upload completes
 *   - media_type: 'image' | 'video' (inferred from content_type)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = await rateLimit({ key: `upload:${auth.companyId}`, limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { filename, content_type, swipe_id } = body as {
      filename?: string;
      content_type?: string;
      company_id?: string; // ignored — auth.companyId used instead
      swipe_id?: string;
    };

    if (!filename || !content_type) {
      return NextResponse.json(
        { error: 'Missing filename or content_type' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
    ];
    if (!allowedTypes.includes(content_type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF, MP4, MOV, WebM' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Sanitize extension to alphanumeric only to prevent path injection
    const rawExt = filename.split('.').pop() || 'bin';
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const stub = swipe_id || `tmp-${crypto.randomUUID().slice(0, 8)}`;
    // Use auth.companyId (server-verified) — never trust company_id from the request body
    const path = `swipe-files/${auth.companyId}/${stub}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('company-assets')
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('createSignedUploadUrl error:', error);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path: data.path,
      token: data.token,
      public_url: urlData.publicUrl,
      media_type: content_type.startsWith('video/') ? 'video' : 'image',
      media_source: 'upload',
    });
  } catch (err) {
    console.error('Swipe upload sign error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
