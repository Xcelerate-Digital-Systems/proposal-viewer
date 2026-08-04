import { describe, it, expect } from 'vitest';
import { hashApiKey, API_KEY_PREFIX } from '@/lib/api-auth';

describe('hashApiKey', () => {
  it('produces a deterministic SHA-256 hex hash', () => {
    const hash1 = hashApiKey('av_live_test123');
    const hash2 = hashApiKey('av_live_test123');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different keys', () => {
    const hash1 = hashApiKey('av_live_key_a');
    const hash2 = hashApiKey('av_live_key_b');
    expect(hash1).not.toBe(hash2);
  });
});

describe('API_KEY_PREFIX', () => {
  it('is av_live_', () => {
    expect(API_KEY_PREFIX).toBe('av_live_');
  });
});
