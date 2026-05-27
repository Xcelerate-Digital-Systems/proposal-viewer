// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isValidEmail } from '@/lib/sanitize';
import { sendPasswordResetEmail } from '@/lib/auth-emails';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

const FORGOT_LIMIT = 5;
const FORGOT_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    // IP-based rate limit. Prevents enumeration via send-and-time and
    // bounds Resend cost from spray attacks.
    const rl = await rateLimit({
      key: `auth:forgot:${ipFromRequest(req)}`,
      limit: FORGOT_LIMIT,
      windowSeconds: FORGOT_WINDOW_SECONDS,
      failClosed: true,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rl, FORGOT_LIMIT) },
      );
    }

    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Hardcoded base URL — never trust the Origin header. An attacker can set
    // Origin: https://evil.com on a cross-origin POST and trick us into
    // emailing the victim a recovery link that lands on evil.com with the
    // session token in the URL.
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_APP_URL is not configured — cannot mint a safe reset link');
      return NextResponse.json({ success: true }); // don't leak the misconfig
    }
    const redirectTo = `${baseUrl}/reset-password`;

    const supabase = createServiceClient();

    // Mint a recovery link without triggering Supabase's built-in email.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
      options: { redirectTo },
    });

    // Don't reveal whether the email exists — always 200.
    // Log server-side so we still notice real failures.
    if (error || !data?.properties?.action_link) {
      if (error && error.message && !/not.*found|user.*does.*not.*exist/i.test(error.message)) {
        console.error('generateLink error:', error.message);
      }
      return NextResponse.json({ success: true });
    }

    try {
      await sendPasswordResetEmail({
        to: email.toLowerCase(),
        resetUrl: data.properties.action_link,
      });
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      // Still return success — don't leak which addresses exist.
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
