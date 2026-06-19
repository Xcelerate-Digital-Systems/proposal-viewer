// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PROTECTED_FIELDS = new Set([
  'id', 'company_id', 'share_token',
  'created_at', 'updated_at',
]);

function stripProtected<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!PROTECTED_FIELDS.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

// POST — Create a new document (PDF already uploaded to storage by client).
// Applies company-level cover/branding defaults to the new record.
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'documents');
    if (limited) return limited;


    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { title, description, file_path, file_size_bytes, ...rest } = body;

    if (!title || !file_path) {
      return NextResponse.json(
        { error: 'Missing required fields: title, file_path' },
        { status: 400 },
      );
    }

    const limitCheck = await checkResourceLimit(auth.companyId, 'documents');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'documents'), { status: 402 });
    }

    const safeRest = stripProtected(rest);
    const brandingDefaults = await getCompanyEntityDefaults(supabase, auth.companyId, {
      overrides: safeRest,
    });

    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        title,
        description:     description     || null,
        file_path,
        file_size_bytes: file_size_bytes ?? 0,
        page_names:      [],
        company_id:      auth.companyId,
        ...brandingDefaults,
        ...safeRest,
      })
      .select('id')
      .single();

    if (insertError || !doc) {
      console.error('[api/documents] POST insert:', insertError?.message);
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, document_id: doc.id });
  } catch (err) {
    console.error('Document POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Update top-level fields on a document (e.g. page_order)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'documents');
    if (limited) return limited;


    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('documents')
      .update(stripProtected(fields))
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/documents] PATCH:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Document PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
