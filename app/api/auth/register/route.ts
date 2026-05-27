// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { isPublicSignupAllowed } from '@/lib/public-signup';
import { sendWelcomeEmail } from '@/lib/auth-emails';

export const dynamic = 'force-dynamic';

const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit({
      key: `auth:register:${ipFromRequest(req)}`,
      limit: REGISTER_LIMIT,
      windowSeconds: REGISTER_WINDOW_SECONDS,
      failClosed: true,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, REGISTER_LIMIT) },
      );
    }

    // The user must already be authenticated against Supabase Auth (signUp
    // returns a session immediately for email/password). Trust the verified
    // identity, never the body — otherwise an attacker with a leaked invite
    // token could attach their own auth user to a victim's company.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, invite_token, company_name } = await req.json().catch(() => ({}));
    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userId = user.id;
    const email = user.email.toLowerCase();

    const supabase = createServiceClient();

    // Check if team member already exists. A single user can belong to
    // multiple companies, so any existing row is enough to short-circuit.
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ id: existing[0].id });
    }

    // ── Invite branch ──────────────────────────────────────────────────────
    // Unchanged from the pre-self-serve flow. An invite always wins over the
    // self-serve gate so existing teammate flows keep working regardless of
    // PUBLIC_SIGNUP_ENABLED.
    if (invite_token) {
      const { data: invite } = await supabase
        .from('company_invites')
        .select('*')
        .eq('token', invite_token)
        .is('accepted_at', null)
        .single();

      if (!invite) {
        return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
      }

      if (invite.email.toLowerCase() !== email) {
        return NextResponse.json(
          { error: 'This invite was sent to a different email address' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          user_id: userId,
          name,
          email,
          role: invite.role,
          company_id: invite.company_id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[api/auth/register] invite member insert:', error.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      await supabase
        .from('company_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      return NextResponse.json({ id: data.id });
    }

    // ── Self-serve branch ──────────────────────────────────────────────────
    // Gated by PUBLIC_SIGNUP_ENABLED (or per-email allowlist). When the gate
    // is closed this returns the same 403 + message users see today, so the
    // live app behaves exactly as it always has until the flag flips.
    if (!isPublicSignupAllowed(email)) {
      return NextResponse.json(
        { error: 'Sign-up requires an invite. Ask your team owner to invite you.' },
        { status: 403 },
      );
    }

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Agency name is required to create a new workspace.' },
        { status: 400 },
      );
    }

    const trimmedCompanyName = company_name.trim().slice(0, 120);
    const slug = await generateUniqueCompanySlug(supabase, trimmedCompanyName);

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: trimmedCompanyName,
        slug,
        account_type: 'agency',
        signup_source: 'self_serve',
        onboarding_completed_at: null,
      })
      .select('id')
      .single();

    if (companyError || !company) {
      console.error('[api/auth/register] self-serve company insert:', companyError?.message);
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 },
      );
    }

    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        name,
        email,
        role: 'owner',
        company_id: company.id,
      })
      .select('id')
      .single();

    if (memberError || !member) {
      // Roll back the company row so a half-created workspace doesn't linger
      // and block a retry. Service role bypasses the FK cascade restriction.
      await supabase.from('companies').delete().eq('id', company.id);
      console.error('[api/auth/register] self-serve member insert:', memberError?.message);
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 },
      );
    }

    // Fire welcome email best-effort. Invited teammates already get the
    // invite email so we only send this on the self-serve branch.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.agencyviz.io').replace(
      /\/+$/,
      '',
    );
    const firstName = name.split(' ')[0] || name;
    sendWelcomeEmail({
      to: email,
      firstName,
      companyName: trimmedCompanyName,
      appUrl,
    }).catch((err) => {
      // Non-fatal — never block account creation on a transactional email
      // hiccup. The user already sees the success response and gets routed
      // to /onboarding.
      console.error('Welcome email failed:', err);
    });

    return NextResponse.json({ id: member.id, company_id: company.id });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Build a URL-friendly slug from the agency name and append a short random
 * suffix on collision. Bounded retries because the slug column is unique
 * and we never want to loop forever on a degenerate input.
 */
async function generateUniqueCompanySlug(
  supabase: ReturnType<typeof createServiceClient>,
  name: string,
): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'agency';

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix(6)}`;
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Extremely unlikely after 8 retries with 36^6 ≈ 2B suffix space, but
  // fall back to a fully random slug rather than throwing.
  return `${base}-${randomSuffix(10)}`;
}

function randomSuffix(len: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = require('crypto').randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
