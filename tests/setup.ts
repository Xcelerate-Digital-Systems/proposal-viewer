import { vi } from 'vitest';

vi.stubEnv('SHARE_AUTH_SECRET', 'test-secret-for-hmac-signing-32bytes!');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
