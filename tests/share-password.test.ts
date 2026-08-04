import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashSharePassword,
  verifySharePassword,
  generateShareAuthCookie,
  verifyShareAuthCookie,
} from '@/lib/feedback/share-password';

describe('hashSharePassword / verifySharePassword', () => {
  it('hashes and verifies a correct password', () => {
    const hash = hashSharePassword('my-secret-123');
    expect(verifySharePassword('my-secret-123', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashSharePassword('correct-password');
    expect(verifySharePassword('wrong-password', hash)).toBe(false);
  });

  it('produces different hashes for the same password (unique salt)', () => {
    const h1 = hashSharePassword('same-password');
    const h2 = hashSharePassword('same-password');
    expect(h1).not.toBe(h2);
  });

  it('rejects malformed stored hash (no colon)', () => {
    expect(verifySharePassword('anything', 'no-colon-here')).toBe(false);
  });

  it('rejects invalid hex in stored hash', () => {
    expect(verifySharePassword('anything', 'zzzz:yyyy')).toBe(false);
  });

  it('handles empty password', () => {
    const hash = hashSharePassword('');
    expect(verifySharePassword('', hash)).toBe(true);
    expect(verifySharePassword('non-empty', hash)).toBe(false);
  });
});

describe('generateShareAuthCookie / verifyShareAuthCookie', () => {
  it('generates and verifies a valid cookie', () => {
    const cookie = generateShareAuthCookie('share_abc123');
    const result = verifyShareAuthCookie(cookie);
    expect(result).not.toBeNull();
    expect(result!.token).toBe('share_abc123');
    expect(result!.timestamp).toBeGreaterThan(0);
  });

  it('rejects a tampered signature', () => {
    const cookie = generateShareAuthCookie('share_abc123');
    const parts = cookie.split(':');
    parts[2] = 'a'.repeat(32);
    expect(verifyShareAuthCookie(parts.join(':'))).toBeNull();
  });

  it('rejects a tampered token', () => {
    const cookie = generateShareAuthCookie('share_abc123');
    const parts = cookie.split(':');
    parts[0] = 'share_evil';
    expect(verifyShareAuthCookie(parts.join(':'))).toBeNull();
  });

  it('rejects a cookie with wrong number of parts', () => {
    expect(verifyShareAuthCookie('only-one-part')).toBeNull();
    expect(verifyShareAuthCookie('a:b:c:d')).toBeNull();
  });

  it('rejects an expired cookie (>30 days)', () => {
    const cookie = generateShareAuthCookie('share_old');
    const parts = cookie.split(':');
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    parts[1] = thirtyOneDaysAgo.toString();
    const payload = `${parts[0]}:${parts[1]}`;
    const { createHmac } = require('crypto');
    const secret = process.env.SHARE_AUTH_SECRET;
    const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
    const forgedCookie = `${payload}:${sig}`;
    expect(verifyShareAuthCookie(forgedCookie)).toBeNull();
  });

  it('accepts a cookie within 30 days', () => {
    const cookie = generateShareAuthCookie('share_recent');
    const parts = cookie.split(':');
    const twentyNineDaysAgo = Date.now() - 29 * 24 * 60 * 60 * 1000;
    parts[1] = twentyNineDaysAgo.toString();
    const payload = `${parts[0]}:${parts[1]}`;
    const { createHmac } = require('crypto');
    const secret = process.env.SHARE_AUTH_SECRET;
    const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
    const validCookie = `${payload}:${sig}`;
    expect(verifyShareAuthCookie(validCookie)).not.toBeNull();
  });

  it('throws when no secret is configured', () => {
    const original = process.env.SHARE_AUTH_SECRET;
    const originalFallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SHARE_AUTH_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => generateShareAuthCookie('share_x')).toThrow();
    process.env.SHARE_AUTH_SECRET = original;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalFallback;
  });

  it('returns null on verify when no secret is configured', () => {
    const cookie = generateShareAuthCookie('share_y');
    const original = process.env.SHARE_AUTH_SECRET;
    const originalFallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SHARE_AUTH_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(verifyShareAuthCookie(cookie)).toBeNull();
    process.env.SHARE_AUTH_SECRET = original;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalFallback;
  });
});
