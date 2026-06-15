// AES-256-GCM encryption for OAuth plaintext tokens stored in oauth_auth_codes.
//
// Derives a purpose-specific key from SUPABASE_SERVICE_ROLE_KEY via HKDF so
// we don't need yet another env var. The derivation ensures this key can't
// decrypt Meta tokens (and vice versa) even though both use AES-256-GCM.

import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const PURPOSE = 'oauth-auth-code-token';

function deriveKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for OAuth token encryption');
  return Buffer.from(hkdfSync('sha256', secret, '', PURPOSE, 32));
}

export function encryptOAuthToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

export function decryptOAuthToken(stored: string): string {
  const key = deriveKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted OAuth token');
  const [ivB64, ciphertextB64, authTagB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]).toString('utf8');
}
