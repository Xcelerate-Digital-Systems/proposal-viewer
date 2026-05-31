// AES-256-GCM encryption for GoHighLevel private integration tokens.
//
// Uses a dedicated GHL_TOKEN_ENCRYPTION_KEY env var (base64-encoded 32 bytes).
// Generate once with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Stored format (single string, colon-delimited):
//   <iv_b64>:<ciphertext_b64>:<authTag_b64>

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const b64 = process.env.GHL_TOKEN_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error('GHL_TOKEN_ENCRYPTION_KEY env var is not set');
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `GHL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). ` +
      `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}

export function encryptGhlToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

export function decryptGhlToken(stored: string): string {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted GHL token');
  }
  const [ivB64, ciphertextB64, authTagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
