import { createHmac } from 'crypto';

const SECRET = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-fallback';

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
  if (sig !== expected) return null;

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
