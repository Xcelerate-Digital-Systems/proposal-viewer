// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to handle custom domain routing.
 *
 * When a request comes from a custom domain (e.g. proposals.clientco.com),
 * only allow access to the proposal viewer routes (/view/...) and the
 * supporting API/asset routes they need. Everything else (admin dashboard,
 * login, settings, etc.) gets redirected to the main app domain.
 */

// Routes that are allowed on custom domains
const ALLOWED_PREFIXES = [
  '/view/',            // Proposal viewer pages
  '/api/company/branding', // Viewer fetches branding
  '/api/notify',       // Viewer fires notification events
  '/api/proposals/',   // Viewer needs proposal data (accept, comments)
  '/_next/',           // Next.js assets (JS, CSS, images)
  '/favicon',          // Favicon files
];

// Exact paths allowed on custom domains
const ALLOWED_EXACT = [
  '/favicon.ico',
  '/favicon.svg',
];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Determine the main app hostname from env or Vercel defaults
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const mainHostname = appUrl ? new URL(appUrl).hostname : '';

  // List of hostnames that are "ours" (not custom domains)
  const ownHostnames = [
    'localhost',
    '127.0.0.1',
    mainHostname,
  ].filter(Boolean);

  // Check if the hostname (without port) is a known own hostname or a Vercel preview
  const hostnameWithoutPort = hostname.split(':')[0];
  const isOwnDomain =
    ownHostnames.includes(hostnameWithoutPort) ||
    hostnameWithoutPort.endsWith('.vercel.app');

  // If it's our own domain, let everything through
  if (isOwnDomain) {
    return NextResponse.next();
  }

  // This is a custom domain — only allow viewer-related routes
  const isAllowed =
    ALLOWED_EXACT.includes(pathname) ||
    ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isAllowed) {
    return NextResponse.next();
  }

  // For the root path on a custom domain, show a simple branded message
  // rather than redirecting (the client likely typed the domain directly)
  if (pathname === '/') {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposals</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f0f;
      color: #888;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    }
    .container { padding: 2rem; }
    h1 { color: #fff; font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Proposal Portal</h1>
    <p>Please use the link provided to view your proposal.</p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Block all other routes on custom domains with a 404
  return new NextResponse('Not Found', { status: 404 });
}

export const config = {
  // Run on all routes except static files
  matcher: ['/((?!_next/static|_next/image|images/).*)'],
};