import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Next.js's App Router extends the global fetch with a Data Cache that keys on
// URL. supabase-js uses fetch() under the hood, so every GET PostgREST request
// is a cache candidate — meaning a query that returns [] once will keep
// returning [] until the cache entry is evicted. That's catastrophic for DB
// reads. Force every supabase request through an uncached fetch.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

// Lazily cached per env-var values so key rotation in a new deployment
// picks up the new key without waiting for all warm instances to cold-start.
let _client: SupabaseClient | null = null;
let _cachedUrl: string | undefined;
let _cachedKey: string | undefined;

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  if (_client && _cachedUrl === supabaseUrl && _cachedKey === serviceRoleKey) {
    return _client;
  }

  _cachedUrl = supabaseUrl;
  _cachedKey = serviceRoleKey;
  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
  return _client;
}
