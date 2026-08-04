import { describe, it, expect } from 'vitest';
import { isValidHttpUrl, isValidWebhookUrl } from '@/lib/sanitize';

describe('isValidHttpUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidHttpUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects ftp: protocol', () => {
    expect(isValidHttpUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(isValidHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidHttpUrl('')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isValidHttpUrl('not a url')).toBe(false);
  });
});

describe('isValidWebhookUrl — SSRF protection', () => {
  it('accepts public URLs', () => {
    expect(isValidWebhookUrl('https://api.example.com/webhook')).toBe(true);
    expect(isValidWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isValidWebhookUrl('http://localhost/admin')).toBe(false);
    expect(isValidWebhookUrl('http://localhost:3000')).toBe(false);
  });

  it('blocks 127.0.0.1', () => {
    expect(isValidWebhookUrl('http://127.0.0.1')).toBe(false);
    expect(isValidWebhookUrl('http://127.0.0.1:8080/api')).toBe(false);
  });

  it('blocks full loopback range (127.x.x.x)', () => {
    expect(isValidWebhookUrl('http://127.0.0.2')).toBe(false);
    expect(isValidWebhookUrl('http://127.255.255.255')).toBe(false);
  });

  it('blocks RFC 1918 private IPs (10.x)', () => {
    expect(isValidWebhookUrl('http://10.0.0.1')).toBe(false);
    expect(isValidWebhookUrl('http://10.255.255.255')).toBe(false);
  });

  it('blocks RFC 1918 private IPs (172.16-31.x)', () => {
    expect(isValidWebhookUrl('http://172.16.0.1')).toBe(false);
    expect(isValidWebhookUrl('http://172.31.255.255')).toBe(false);
  });

  it('allows non-private 172.x IPs', () => {
    expect(isValidWebhookUrl('http://172.15.0.1')).toBe(true);
    expect(isValidWebhookUrl('http://172.32.0.1')).toBe(true);
  });

  it('blocks RFC 1918 private IPs (192.168.x)', () => {
    expect(isValidWebhookUrl('http://192.168.0.1')).toBe(false);
    expect(isValidWebhookUrl('http://192.168.1.1')).toBe(false);
  });

  it('blocks AWS metadata endpoint', () => {
    expect(isValidWebhookUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('blocks link-local addresses', () => {
    expect(isValidWebhookUrl('http://169.254.0.1')).toBe(false);
  });

  it('blocks CGNAT range (100.64.0.0/10)', () => {
    expect(isValidWebhookUrl('http://100.64.0.1')).toBe(false);
    expect(isValidWebhookUrl('http://100.127.255.255')).toBe(false);
  });

  it('blocks 0.0.0.0', () => {
    expect(isValidWebhookUrl('http://0.0.0.0')).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(isValidWebhookUrl('http://[::1]')).toBe(false);
  });

  it('blocks IPv6 link-local', () => {
    expect(isValidWebhookUrl('http://[fe80::1]')).toBe(false);
  });

  it('blocks IPv6 ULA (fc/fd)', () => {
    expect(isValidWebhookUrl('http://[fc00::1]')).toBe(false);
    expect(isValidWebhookUrl('http://[fd12:3456::1]')).toBe(false);
  });

  it('blocks decimal-encoded IPs', () => {
    expect(isValidWebhookUrl('http://2130706433')).toBe(false);
  });

  it('blocks backslash-based URL tricks', () => {
    expect(isValidWebhookUrl('http://example.com\\@evil.com')).toBe(false);
  });

  it('blocks GCP metadata hostname', () => {
    expect(isValidWebhookUrl('http://metadata.google.internal')).toBe(false);
  });

  it('rejects non-http protocols', () => {
    expect(isValidWebhookUrl('ftp://public-server.com/file')).toBe(false);
    expect(isValidWebhookUrl('file:///etc/passwd')).toBe(false);
  });
});
