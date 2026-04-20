// app/api/ads/tracker/[trackerId]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/ads/tracker/[trackerId]/share
 *   Generate (or return existing) public share token for this tracker.
 *
 * DELETE /api/ads/tracker/[trackerId]/share
 *   Revoke the token.
 */

async function verifyTrackerAccess(req: NextRequest, trackerId: string) {
  const auth = await getAuthContext(req);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabase = createServiceClient();
  const { data: tracker } = await supabase
    .from('ad_trackers')
    .select('id, company_id, share_token')
    .eq('id', trackerId)
    .single();

  if (!tracker) {
    return { error: NextResponse.json({ error: 'Tracker not found' }, { status: 404 }) };
  }

  if (tracker.company_id !== auth.companyId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { tracker, supabase };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { trackerId: string } }
) {
  const check = await verifyTrackerAccess(req, params.trackerId);
  if ('error' in check) return check.error;

  const { tracker, supabase } = check;
  const existing = (tracker as { share_token: string | null }).share_token;
  const newToken = existing || crypto.randomUUID();

  if (!existing) {
    const { error } = await supabase
      .from('ad_trackers')
      .update({ share_token: newToken, updated_at: new Date().toISOString() })
      .eq('id', params.trackerId);
    if (error) {
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }
  }

  return NextResponse.json({ token: newToken });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { trackerId: string } }
) {
  const check = await verifyTrackerAccess(req, params.trackerId);
  if ('error' in check) return check.error;

  const { supabase } = check;
  const { error } = await supabase
    .from('ad_trackers')
    .update({ share_token: null, updated_at: new Date().toISOString() })
    .eq('id', params.trackerId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
  }

  return NextResponse.json({ revoked: true });
}
