// app/api/review-comments/video-upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/review-comments/video-upload
 *
 * Upload a recorded video clip (from the VideoRecorderModal) to the
 * review-videos bucket. Accepts multipart/form-data with:
 *   - file: the recorded blob (video/webm typically)
 *   - company_id (admin path) OR share_token (public reviewer path)
 *
 * Returns { url }.
 *
 * Bucket is public-read; filenames are uuid-prefixed so URLs aren't
 * guessable. Writes always go through the service role here.
 */
const MAX_BYTES = 100 * 1024 * 1024; // 100MB — matches bucket file_size_limit
const ALLOWED_MIME = new Set(['video/webm', 'video/mp4', 'video/ogg']);

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const companyIdRaw = formData.get('company_id') as string | null;
    const shareToken = formData.get('share_token') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!companyIdRaw && !shareToken) {
      return NextResponse.json({ error: 'Missing company_id or share_token' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
    }

    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported video type: ${file.type}` }, { status: 400 });
    }

    // Resolve a scope segment for the storage path. For public uploads we
    // validate the share token against review_projects so we don't let a bad
    // actor dump files under arbitrary paths — the write still uses the
    // service role, but the path is tied to a real project.
    let scope: string;
    if (companyIdRaw) {
      // Admin path — require authentication and verify company ownership
      const auth = await getAuthContext(req);
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!auth.member.is_super_admin && companyIdRaw !== auth.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      scope = `company/${companyIdRaw}`;
    } else {
      const { data: project } = await supabase
        .from('review_projects')
        .select('id, company_id')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (!project) {
        return NextResponse.json({ error: 'Invalid share token' }, { status: 403 });
      }
      scope = `project/${project.id}`;
    }

    const ext = (file.type === 'video/mp4' ? 'mp4'
      : file.type === 'video/ogg' ? 'ogv'
      : 'webm');
    const path = `${scope}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('review-videos')
      .upload(path, file, { contentType: file.type || 'video/webm' });

    if (uploadError) {
      console.error('Video upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('review-videos')
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Video upload API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
