import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit({ key: `support:upload:${auth.companyId}`, limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const ALLOWED_TYPES = new Set([
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/quicktime', 'video/webm',
    ]);
    const ALLOWED_EXT = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'mov', 'webm',
    ]);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, GIF, WebP, PDF, or video.' }, { status: 415 });
    }

    const supabase = createServiceClient();
    const path = `support-attachments/${auth.companyId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error('[support/attachments] upload:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error('[support/attachments] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
