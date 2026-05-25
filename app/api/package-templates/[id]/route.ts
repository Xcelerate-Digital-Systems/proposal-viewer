// app/api/package-templates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('package_templates')
    .delete()
    .eq('id', params.id)
    .eq('company_id', auth.companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
