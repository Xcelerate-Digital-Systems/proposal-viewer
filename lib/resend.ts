// lib/resend.ts
import { Resend } from 'resend';

let _resend: Resend | null = null;

export function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        'RESEND_API_KEY is not set. Email delivery requires this environment variable.',
      );
    }
    _resend = new Resend(key);
  }
  return _resend;
}

export const FROM_EMAIL = process.env.EMAIL_FROM || 'AgencyViz <notifications@update.agencyviz.io>';

const FROM_ADDRESS = FROM_EMAIL.match(/<(.+)>/)?.[1] || FROM_EMAIL;

export function fromEmail(companyName?: string | null): string {
  if (!companyName?.trim()) return FROM_EMAIL;
  const safe = companyName.trim().replace(/[<>"]/g, '');
  return `${safe} <${FROM_ADDRESS}>`;
}