// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { isValidEmail } from '@/lib/sanitize';
import { sendPasswordResetEmail } from '@/lib/auth-emails';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const redirectTo = `${baseUrl}/reset-password`;

    const supabase = createServiceClient();

    // Mint a recovery link without triggering Supabase's built-in email.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
      options: { redirectTo },
    });

    // Don't reveal whether the email exists — always 200.
    // Log server-side so we still notice real failures.
    if (error || !data?.properties?.action_link) {
      if (error && error.message && !/not.*found|user.*does.*not.*exist/i.test(error.message)) {
        console.error('generateLink error:', error.message);
      }
      return NextResponse.json({ success: true });
    }

    try {
      await sendPasswordResetEmail({
        to: email.toLowerCase(),
        resetUrl: data.properties.action_link,
      });
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      // Still return success — don't leak which addresses exist.
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
