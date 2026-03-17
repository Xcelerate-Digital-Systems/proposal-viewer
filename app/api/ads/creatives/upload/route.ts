// app/api/ads/creatives/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/ads/creatives/upload
 *
 * Upload an ad creative image/video.
 * Accepts multipart/form-data with:
 *   - file: the file to upload (image or video, max 50MB)
 *   - creative_id: the ad creative to attach it to
 *   - company_id: for storage path scoping
 *
 * Returns { url }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const creativeId = formData.get('creative_id') as string | null;
    const companyId = formData.get('company_id') as string | null;

    if (!file || !creativeId || !companyId) {
      return NextResponse.json({ error: 'Missing file, creative_id, or company_id' }, { status: 400 });
    }

    // 50MB limit for videos
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepted: JPEG, PNG, WebP, GIF, MP4, MOV, WebM' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const path = `ad-creatives/${companyId}/${creativeId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error('Ad creative upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    // Update the creative's image_url
    const { error: updateError } = await supabase
      .from('ad_creatives')
      .update({ image_url: urlData.publicUrl })
      .eq('id', creativeId)
      .eq('company_id', companyId);

    if (updateError) {
      console.error('Update image_url error:', updateError);
      return NextResponse.json({ error: 'Uploaded but failed to save URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (err) {
    console.error('Ad creative upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
