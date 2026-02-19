// app/api/company/logo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

async function getAuthenticatedMember(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return member;
}

// POST - Upload company logo
export async function POST(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can update the logo' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use PNG, JPEG, SVG, or WebP' },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 2MB' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${member.company_id}/logo.${ext}`;

    // Upload to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Update company record
    const { error: updateError } = await supabase
      .from('companies')
      .update({ logo_path: filePath, updated_at: new Date().toISOString() })
      .eq('id', member.company_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(filePath);

    return NextResponse.json({
      logo_path: filePath,
      logo_url: urlData?.publicUrl || null,
    });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove company logo
export async function DELETE(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can remove the logo' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Get current logo path
    const { data: company } = await supabase
      .from('companies')
      .select('logo_path')
      .eq('id', member.company_id)
      .single();

    if (company?.logo_path) {
      await supabase.storage
        .from('company-assets')
        .remove([company.logo_path]);
    }

    // Clear logo_path
    await supabase
      .from('companies')
      .update({ logo_path: null, updated_at: new Date().toISOString() })
      .eq('id', member.company_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Logo delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}