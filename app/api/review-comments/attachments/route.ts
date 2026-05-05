// app/api/review-comments/attachments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/review-comments/attachments
 *
 * Upload a file attachment for a review comment.
 * Accepts multipart/form-data with:
 *   - file: the file to upload
 *   - share_token: a review project or review item share_token (public callers)
 *   OR an Authorization: Bearer header (admin callers).
 *
 * `company_id` is derived from the verified token / session; the form-supplied
 * value is ignored to prevent cross-tenant storage writes.
 *
 * Returns { url, name, type, size }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const shareToken = formData.get('share_token') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // ── Resolve company_id from one of: admin auth or public share token ──
    let companyId: string | null = null;

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const auth = await getAuthContext(req);
      if (auth) companyId = auth.companyId;
    }

    if (!companyId && shareToken) {
      // Try project share_token first, then item share_token.
      const { data: project } = await supabase
        .from('review_projects')
        .select('company_id')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (project?.company_id) {
        companyId = project.company_id;
      } else {
        const { data: item } = await supabase
          .from('review_items')
          .select('company_id')
          .eq('share_token', shareToken)
          .maybeSingle();
        if (item?.company_id) companyId = item.company_id;
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'A valid share_token or Authorization header is required' },
        { status: 401 },
      );
    }

    const ext = file.name.split('.').pop() || 'bin';
    const path = `review-attachments/${companyId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error('Attachment upload error:', uploadError);
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
    console.error('Attachment API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
