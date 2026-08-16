import { createTokenCrypto } from '@/lib/connectors/token-crypto';

const crypto = createTokenCrypto('GOOGLE_TOKEN_ENCRYPTION_KEY');

export const encryptToken = crypto.encrypt;
export const decryptToken = crypto.decrypt;
