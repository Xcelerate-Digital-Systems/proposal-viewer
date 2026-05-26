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
    // Fail open. Rate limiting is defense-in-depth; an outage here shouldn't
    // lock users out of legitimate flows. Log so we notice.
    console.error('[rate-limit] check failed, failing open:', error);
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
 *  visible — better than failing open per-request. */
export function ipFromRequest(req: NextRequest | Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  return 'unknown';
}

/** Standard `X-RateLimit-*` headers to return alongside a response. */
export function rateLimitHeaders(rl: RateLimitResult, limit: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rl.reset.getTime() / 1000)),
  };
}
