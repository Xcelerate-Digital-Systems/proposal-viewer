// app/api/waitlist/route.ts
//
// POST /api/waitlist
// Public, unauthenticated. Accepts { email, agency_name?, source? } from
// the /pricing page (and any other landing surface) while public signup
// is gated. Rate-limited per IP; dedup-on-email so re-submitting the
// same address is a silent no-op (slight privacy gain — doesn't reveal
// whether the email was already on the list).

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { isValidEmail } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const WAITLIST_LIMIT = 5;
const WAITLIST_WINDOW_SECONDS = 60;
const MAX_AGENCY_NAME = 120;
const MAX_SOURCE = 40;

export async function POST(req: NextRequest) {
  try {
    const ip = ipFromRequest(req);

    const rl = await rateLimit({
      key: `waitlist:${ip}`,
      limit: WAITLIST_LIMIT,
      windowSeconds: WAITLIST_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, WAITLIST_LIMIT) },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email: string | undefined =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const agencyName: string | null =
      typeof body.agency_name === 'string' && body.agency_name.trim().length > 0
        ? body.agency_name.trim().slice(0, MAX_AGENCY_NAME)
        : null;
    const source: string | null =
      typeof body.source === 'string' && body.source.length > 0
        ? body.source.slice(0, MAX_SOURCE)
        : null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    // Insert; swallow unique-violation so duplicate signups are silent.
    const { error } = await supabase.from('waitlist').insert({
      email,
      agency_name: agencyName,
      source,
      ip,
      user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    });

    if (error && !/duplicate key|already exists/i.test(error.message)) {
      console.error('waitlist insert error:', error.message);
      return NextResponse.json({ error: 'Could not save your spot — try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('waitlist route fatal:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
