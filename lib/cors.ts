// lib/cors.ts
import { NextResponse } from 'next/server';

/**
 * Permissive CORS headers for routes that need to be callable from the
 * Agency Viz Chrome extension (chrome-extension://<id>) and from arbitrary
 * origins. Auth is enforced separately by the route's API-key check, so the
 * wildcard origin is safe — there are no cookies or session credentials in
 * play (extension uses a Bearer api key).
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export function withCors<T>(res: NextResponse<T>): NextResponse<T> {
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}
