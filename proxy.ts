// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// On the apex domain (agencyviz.io), rewrite "/" to the public marketing home.
// Everything else (including app.agencyviz.io) passes through unchanged.
export function proxy(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0];
  const { pathname } = request.nextUrl;

  if (pathname === '/' && (hostname === 'agencyviz.io' || hostname === 'www.agencyviz.io')) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.rewrite(url);
  }

  // Redirect legacy /markup routes to /campaigns (items → assets).
  if (pathname === '/markup' || pathname.startsWith('/markup/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname
      .replace(/^\/markup/, '/campaigns')
      .replace(/\/items(\/|$)/, '/assets$1');
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/markup/:path*'],
};
