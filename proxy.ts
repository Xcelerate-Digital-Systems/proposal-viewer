import { NextRequest, NextResponse } from 'next/server';

function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '');
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://js.stripe.com https://unpkg.com ${posthogHost}`,
    `worker-src 'self' blob:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com`,
    `font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com data:`,
    `img-src 'self' blob: data: https: http: https://${supabaseHost} https://*.supabase.co`,
    `connect-src 'self' ${supabaseUrl} wss://${supabaseHost} ${posthogHost} https://api.stripe.com https://api.resend.com https://*.ingest.sentry.io`,
    `frame-src 'self' https://js.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const { pathname } = request.nextUrl;

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Pass nonce to server components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // On the apex domain, rewrite "/" to the public marketing home.
  if (pathname === '/' && (hostname === 'agencyviz.io' || hostname === 'www.agencyviz.io')) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
    return response;
  }

  // Redirect legacy /markup routes to /campaigns (items → assets).
  if (pathname === '/markup' || pathname.startsWith('/markup/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname
      .replace(/^\/markup/, '/campaigns')
      .replace(/\/items(\/|$)/, '/assets$1');
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.svg|apple-touch-icon\\.png|manifest\\.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)).*)',
  ],
};
