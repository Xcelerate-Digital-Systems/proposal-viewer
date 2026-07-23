// lib/feedback/share-password.ts
//
// PBKDF2-based password hashing for share link protection.
// Uses Node.js built-in crypto — no external dependency required.

import { randomBytes, pbkdf2Sync, timingSafeEqual, createHmac } from 'crypto';

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

/**
 * Hash a plaintext password for storage.
 * Returns a string in the format: `salt_hex:hash_hex`
 */
export function hashSharePassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySharePassword(password: string, storedHash: string): boolean {
  const colonIdx = storedHash.indexOf(':');
  if (colonIdx === -1) return false;

  const saltHex = storedHash.slice(0, colonIdx);
  const hashHex = storedHash.slice(colonIdx + 1);

  let salt: Buffer;
  let expectedHash: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expectedHash = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }

  const actualHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);

  if (actualHash.length !== expectedHash.length) return false;
  return timingSafeEqual(actualHash, expectedHash);
}

/**
 * Generate a signed cookie value for password-verified share access.
 * Format: `token:timestamp:signature`
 */
export function generateShareAuthCookie(shareToken: string): string {
  const timestamp = Date.now().toString();
  const payload = `${shareToken}:${timestamp}`;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for share auth cookies');

  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return `${payload}:${sig}`;
}

/**
 * Verify a share auth cookie value.
 * Returns the token if valid, null otherwise.
 */
export function verifyShareAuthCookie(cookieValue: string): { token: string; timestamp: number } | null {
  const parts = cookieValue.split(':');
  if (parts.length !== 3) return null;

  const [token, timestampStr, sig] = parts;
  const payload = `${token}:${timestampStr}`;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;

  const expected = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);

  if (sig.length !== expected.length) return null;
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;

  return { token, timestamp };
}
