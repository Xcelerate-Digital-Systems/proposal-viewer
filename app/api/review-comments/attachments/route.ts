// app/api/review-comments/attachments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * POST /api/review-comments/attachments
 *
 * Upload a file attachment for a review comment.
 * Accepts multipart/form-data with:
 *   - file: the file to upload
 *   - company_id: for storage path scoping
 *
 * Returns { url, name, type, size }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const companyId = formData.get('company_id') as string | null;

    if (!file || !companyId) {
      return NextResponse.json({ error: 'Missing file or company_id' }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
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
