import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

// Change this to your verified domain once set up in Resend
// Until then, Resend allows sending from onboarding@resend.dev
export const FROM_EMAIL = process.env.EMAIL_FROM || 'Xcelerate Digital <onboarding@resend.dev>';