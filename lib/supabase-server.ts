import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side client with service role key — bypasses RLS
// Only use in API routes, never expose to the client
let _client: SupabaseClient | null = null;

export function createServiceClient() {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    _client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}