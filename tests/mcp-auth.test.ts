import { describe, it, expect } from 'vitest';
import { getAuth, unauthorized, txt, json } from '@/lib/mcp/types';

describe('getAuth', () => {
  const baseAuth = {
    token: 'av_live_test',
    clientId: 'mcp',
    scopes: ['campaigns:read'],
    companyId: 'comp_1',
    userId: 'user_1',
    memberId: 'member_1',
    memberName: 'Test User',
    role: 'owner',
    isSuperAdmin: false,
  };

  it('returns auth info when present', () => {
    const result = getAuth({ authInfo: baseAuth });
    expect(result).not.toBeNull();
    expect(result!.companyId).toBe('comp_1');
  });

  it('returns null when no authInfo', () => {
    expect(getAuth({})).toBeNull();
    expect(getAuth({ authInfo: undefined })).toBeNull();
  });

  it('allows same-company override', () => {
    const result = getAuth({ authInfo: baseAuth }, 'comp_1');
    expect(result).not.toBeNull();
    expect(result!.companyId).toBe('comp_1');
  });

  it('blocks cross-company override for non-super-admin', () => {
    const result = getAuth({ authInfo: baseAuth }, 'comp_other');
    expect(result).toBeNull();
  });

  it('allows cross-company override for super admin', () => {
    const superAuth = { ...baseAuth, isSuperAdmin: true };
    const result = getAuth({ authInfo: superAuth }, 'comp_other');
    expect(result).not.toBeNull();
    expect(result!.companyId).toBe('comp_other');
  });
});

describe('response helpers', () => {
  it('unauthorized returns text content', () => {
    const result = unauthorized();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Unauthorized');
  });

  it('txt wraps string in content array', () => {
    const result = txt('hello');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: 'text', text: 'hello' });
  });

  it('json serializes data as pretty JSON', () => {
    const result = json({ id: 1, name: 'test' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ id: 1, name: 'test' });
  });
});
