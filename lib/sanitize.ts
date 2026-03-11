// lib/sanitize.ts
// Shared input validation & sanitization utilities.

/** Validate that a URL uses http: or https: protocol only. */
export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '169.254.169.254', // cloud metadata endpoint
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

/**
 * Validate a webhook URL: must be https (or http), and must not
 * point to private/internal addresses (SSRF protection).
 */
export function isValidWebhookUrl(url: string): boolean {
  if (!isValidHttpUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;
    if (PRIVATE_IP_PATTERNS.some((re) => re.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

/** Basic email format validation (RFC 5322 simplified). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
