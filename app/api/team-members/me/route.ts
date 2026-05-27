// app/api/team-members/me/route.ts
//
// PATCH /api/team-members/me
// Small mutation endpoint for fields the user can change on their *own*
// active membership: notification prefs and tours_completed.
// Distinct from the generic team-members CRUD because (a) we can resolve
// "me" from getAuthContext rather than trusting a body id, and (b) we
// allow only an allow-list of fields — never role, company_id, etc.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type ToursCompletedPatch = Record<string, string>;

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const supabase = createServiceClient();

    // Load the current row so we can MERGE tours_completed instead of
    // overwriting it. A two-tab race could otherwise drop a tour completion
    // (tab A marks tour X complete; tab B marks tour Y complete; the
    // later-completing tab wins and forgets the other tour).
    const { data: current, error: loadError } = await supabase
      .from('team_members')
      .select('tours_completed')
      .eq('id', auth.member.id)
      .single();
    if (loadError || !current) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.tours_completed && typeof body.tours_completed === 'object') {
      const incoming = body.tours_completed as ToursCompletedPatch;
      // Validate shape — string keys + ISO-ish string values only.
      const merged: Record<string, string> = {
        ...((current.tours_completed as Record<string, string> | null) ?? {}),
      };
      for (const [k, v] of Object.entries(incoming)) {
        if (typeof k !== 'string' || k.length === 0 || k.length > 64) continue;
        if (typeof v !== 'string' || v.length > 64) continue;
        merged[k] = v;
      }
      update.tours_completed = merged;
    }

    if (Object.keys(update).length === 1) {
      // Only `updated_at` would change → caller sent nothing actionable.
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('team_members')
      .update(update)
      .eq('id', auth.member.id)
      .select('id, tours_completed')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/team-members/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
