// lib/public-signup.ts
//
// Single source of truth for whether external self-serve signup is permitted.
// Until PUBLIC_SIGNUP_ENABLED flips to "true" the app stays invite-only —
// matching today's behaviour. Optional PUBLIC_SIGNUP_EMAIL_ALLOWLIST lets
// specific emails (Jack's, internal QA) through while the gate is closed
// so the full flow can be smoke-tested without exposing it to the world.
//
// Server is the authority. NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED is a public
// mirror used by the login page to decide whether to render the signup
// form / Google button — but every server route that creates rows MUST
// re-check via isPublicSignupAllowed() with the user's verified email.

export function isPublicSignupEnabled(): boolean {
  return process.env.PUBLIC_SIGNUP_ENABLED === 'true';
}

/** Lowercased + trimmed allowlist parsed from PUBLIC_SIGNUP_EMAIL_ALLOWLIST. */
function getAllowlist(): Set<string> {
  const raw = process.env.PUBLIC_SIGNUP_EMAIL_ALLOWLIST ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
}

export function isEmailAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowlist().has(email.trim().toLowerCase());
}

/**
 * Final gate check. Pass the user's verified email (from Supabase Auth, never
 * the request body). Returns true if either the global flag is on OR the
 * specific email is on the allowlist.
 */
export function isPublicSignupAllowed(email: string | null | undefined): boolean {
  return isPublicSignupEnabled() || isEmailAllowlisted(email);
}
