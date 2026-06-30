// lib/api-fetch.ts
// Re-exports from the canonical auth-fetch module.
// Kept for backward compatibility — new code should import from '@/lib/auth-fetch'.

export { authFetch as authedFetch } from './auth-fetch';
