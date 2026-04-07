// app/api/ads/swipe/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/ads/swipe/files/upload
 *
 * Multipart form upload for a swipe file's media (image or video).
 * Fields:
 *   - file: the uploaded file (max 50MB)
 *   - company_id: scoping
 *   - swipe_id: optional — if provided, the file's media_url/media_type/media_source
 *               is updated. Otherwise the upload is returned without persisting.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const swipeId = formData.get('swipe_id') as string | null;
    const companyId = formData.get('company_id') as string | null;

    if (!file || !companyId) {
      return NextResponse.json({ error: 'Missing file or company_id' }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF, MP4, MOV, WebM' }, { status: 400 });
    }

    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop() || 'bin';
    const stub = swipeId || `tmp-${Math.random().toString(36).slice(2, 10)}`;
    const path = `swipe-files/${companyId}/${stub}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error('Swipe upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    const mediaType = isVideo ? 'video' : 'image';

    if (swipeId) {
      const { error: updateError } = await supabase
        .from('swipe_files')
        .update({
          media_url: urlData.publicUrl,
          media_type: mediaType,
          media_source: 'upload',
          updated_at: new Date().toISOString(),
        })
        .eq('id', swipeId)
        .eq('company_id', companyId);

      if (updateError) {
        console.error('Swipe upload update error:', updateError);
        return NextResponse.json({ error: 'Uploaded but failed to save URL' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      media_type: mediaType,
      media_source: 'upload',
    });
  } catch (err) {
    console.error('Swipe upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
