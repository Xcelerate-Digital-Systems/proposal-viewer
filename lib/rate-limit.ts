// lib/rate-limit.ts
//
// Generic rate-limit helper backed by Postgres via the check_rate_limit RPC.
// API surface mirrors @upstash/ratelimit so the impl can be swapped for
// Upstash/Vercel KV later by editing only this file.
//
// Usage:
//   import { rateLimit, ipFromRequest } from '@/lib/rate-limit';
//
//   const rl = await rateLimit({
//     key: `auth:forgot:${ipFromRequest(req)}`,
//     limit: 5,
//     windowSeconds: 60,
//   });
//   if (!rl.success) {
//     return NextResponse.json({ error: 'Too many requests' }, {
//       status: 429,
//       headers: rateLimitHeaders(rl, 5),
//     });
//   }

import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export interface RateLimitOptions {
  /** Unique bucket key. Pre-namespace with the use case, e.g. `auth:forgot:1.2.3.4`. */
  key: string;
  /** Max requests allowed within `windowSeconds`. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** When true, RPC errors deny the request instead of allowing it through.
   *  Use for auth endpoints where fail-open would let attackers bypass the
   *  rate limit during a Postgres outage. */
  failClosed?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: Date;
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: opts.key,
    p_window_seconds: opts.windowSeconds,
    p_max_requests: opts.limit,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    console.error('[rate-limit] check failed,', opts.failClosed ? 'failing closed' : 'failing open', ':', error);
    if (opts.failClosed) {
      // Auth-critical endpoints: deny the request when we can't verify the
      // rate limit. An attacker could exploit a Postgres outage to bypass
      // brute-force protection.
      return {
        success: false,
        remaining: 0,
        reset: new Date(Date.now() + opts.windowSeconds * 1000),
      };
    }
    // Non-critical endpoints: fail open so a DB hiccup doesn't lock out
    // legitimate users. Rate limiting is defense-in-depth here.
    return {
      success: true,
      remaining: opts.limit,
      reset: new Date(Date.now() + opts.windowSeconds * 1000),
    };
  }

  const row = data[0] as { allowed: boolean; current_count: number; reset_at: string };
  return {
    success: row.allowed,
    remaining: Math.max(0, opts.limit - row.current_count),
    reset: new Date(row.reset_at),
  };
}

/** Pull the client IP off Vercel/proxy headers. Falls back to "unknown" so
 *  the rate limiter still applies (under a shared bucket) when no IP is
 *  visible — better than failing open per-request.
 *
 *  Prefers x-real-ip (set by Vercel to the true client IP and non-spoofable)
 *  over x-forwarded-for. When falling back to XFF, takes the LAST entry
 *  (the one appended by the trusted edge proxy) rather than the first
 *  (attacker-controlled). */
export function ipFromRequest(req: NextRequest | Request): string {
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',');
    return parts[parts.length - 1].trim();
  }
  return 'unknown';
}

/** Standard `X-RateLimit-*` + `Retry-After` headers to return alongside a response. */
export function rateLimitHeaders(rl: RateLimitResult, limit: number): Record<string, string> {
  const resetEpoch = Math.ceil(rl.reset.getTime() / 1000);
  const retryAfter = Math.max(1, resetEpoch - Math.ceil(Date.now() / 1000));
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(resetEpoch),
    'Retry-After': String(retryAfter),
  };
}
