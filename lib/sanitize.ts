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
  '::1',
  '[::0]',
  '::',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
]);

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,  // CGNAT 100.64.0.0/10
  /^169\.254\./,                                    // link-local
  /^127\./,                                         // full loopback range
];

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function looksLikeIPv6(host: string): boolean {
  return host.includes(':');
}

function isPrivateIPv6(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (clean === '::1' || clean === '::' || clean === '::0') return true;
  if (clean.startsWith('fe80:')) return true;   // link-local
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;  // ULA
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(mapped))) return true;
  }
  return false;
}

/**
 * Validate a webhook URL: must be https (or http), and must not
 * point to private/internal addresses (SSRF protection).
 */
export function isValidWebhookUrl(url: string): boolean {
  if (!isValidHttpUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Reject backslash-based tricks (some browsers interpret \ as /)
    if (url.includes('\\')) return false;

    // Block known dangerous hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;

    const cleanHost = hostname.replace(/^\[|\]$/g, '');

    if (IPV4_RE.test(cleanHost)) {
      if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(cleanHost))) return false;
    } else if (looksLikeIPv6(cleanHost)) {
      if (isPrivateIPv6(cleanHost)) return false;
    } else {
      // Non-IP hostname — reject decimal-encoded IPs (e.g. 2130706433 = 127.0.0.1)
      if (/^\d+$/.test(cleanHost)) return false;
      // Reject octal/hex IP forms
      if (/^0x[0-9a-f]+$/i.test(cleanHost)) return false;
      if (/^0\d/.test(cleanHost)) return false;
    }

    // Reject auth-embedded URLs that could bypass hostname checks
    if (parsed.username || parsed.password) return false;

    return true;
  } catch {
    return false;
  }
}

/** Basic email format validation (RFC 5322 simplified). */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
