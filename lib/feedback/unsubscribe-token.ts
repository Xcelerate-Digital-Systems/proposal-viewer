import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for unsubscribe tokens');
  return key;
};

export function generateUnsubscribeToken(projectId: string, email: string): string {
  const payload = `${projectId}:${email.trim().toLowerCase()}`;
  const sig = createHmac('sha256', SECRET()).update(payload).digest('hex').slice(0, 32);
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { projectId: string; email: string } | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = createHmac('sha256', SECRET()).update(payload).digest('hex').slice(0, 32);
  if (sig.length !== expected.length) return null;
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  const colonIdx = payload.indexOf(':');
  if (colonIdx === -1) return null;

  return {
    projectId: payload.slice(0, colonIdx),
    email: payload.slice(colonIdx + 1),
  };
}

export function buildUnsubscribeUrl(appUrl: string, projectId: string, email: string): string {
  const token = generateUnsubscribeToken(projectId, email);
  return `${appUrl}/api/review-unsubscribe?token=${encodeURIComponent(token)}`;
}
