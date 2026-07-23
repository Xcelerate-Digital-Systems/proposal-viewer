// app/api/review/verify-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { verifySharePassword, generateShareAuthCookie } from '@/lib/feedback/share-password';
import { rateLimit, rateLimitHeaders, ipFromRequest } from '@/lib/rate-limit';

/**
 * POST /api/review/verify-password
 *
 * Verify a share link password and set a signed httpOnly cookie.
 * Body: { token: string, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Tight rate limit to prevent brute force (10 attempts per minute per IP)
    const ip = ipFromRequest(req);
    const rl = await rateLimit({ key: `share-pw:${ip}`, limit: 10, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rl, 60) },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.token !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    }

    const { token, password } = body as { token: string; password: string };
    if (!token.trim() || !password) {
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Try item share_token first, then project share_token
    let passwordHash: string | null = null;
    let expiresAt: string | null = null;

    const { data: item } = await supabase
      .from('review_items')
      .select('share_password_hash, share_expires_at')
      .eq('share_token', token)
      .single();

    if (item) {
      passwordHash = item.share_password_hash;
      expiresAt = item.share_expires_at;
    } else {
      const { data: project } = await supabase
        .from('review_projects')
        .select('share_password_hash, share_expires_at')
        .eq('share_token', token)
        .single();

      if (project) {
        passwordHash = project.share_password_hash;
        expiresAt = project.share_expires_at;
      }
    }

    if (!passwordHash) {
      // No password set or token not found — don't reveal which
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
    }

    // Check expiry
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This review link has expired' }, { status: 410 });
    }

    // Verify the password
    if (!verifySharePassword(password, passwordHash)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
    }

    // Generate a signed cookie
    const cookieValue = generateShareAuthCookie(token);

    // Cookie expiry: match the share link expiry, or 30 days if no expiry
    const maxAgeMs = expiresAt
      ? Math.max(0, new Date(expiresAt).getTime() - Date.now())
      : 30 * 24 * 60 * 60 * 1000;
    const maxAgeSec = Math.ceil(maxAgeMs / 1000);

    const res = NextResponse.json({ success: true });
    res.cookies.set(`av_share_auth_${token}`, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSec,
    });

    return res;
  } catch (err) {
    console.error('Share password verification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
