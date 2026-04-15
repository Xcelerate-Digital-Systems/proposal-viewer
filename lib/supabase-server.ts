import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side client with service role key — bypasses RLS
// Only use in API routes, never expose to the client
let _client: SupabaseClient | null = null;

// Next.js's App Router extends the global fetch with a Data Cache that keys on
// URL. supabase-js uses fetch() under the hood, so every GET PostgREST request
// is a cache candidate — meaning a query that returns [] once will keep
// returning [] until the cache entry is evicted. That's catastrophic for DB
// reads. Force every supabase request through an uncached fetch.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export function createServiceClient() {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    _client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { fetch: noStoreFetch },
    });
  }
  return _client;
}