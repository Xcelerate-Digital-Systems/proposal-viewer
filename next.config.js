/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-lib / react-pdf import an optional `canvas` module that only exists
  // in Node, not the browser. Alias it to false in both bundlers so the
  // client bundle doesn't try to resolve it. Keeping both blocks means the
  // project still works if anyone runs `next build` (Turbopack default in
  // Next 16+) or `next build --webpack` (legacy escape hatch).
  turbopack: {
    resolveAlias: {
      canvas: { browser: 'next/dist/compiled/empty' },
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
    const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '');
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com ${posthogHost}`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com`,
      `font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com data:`,
      `img-src 'self' blob: data: https://${supabaseHost} https://*.supabase.co`,
      `connect-src 'self' ${supabaseUrl} wss://${supabaseHost} ${posthogHost} https://api.stripe.com https://api.resend.com`,
      `frame-src 'self' https://js.stripe.com`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ');

    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()' },
      ],
    }];
  },

  // Legacy redirects for renamed surfaces. Old bookmarks and email links keep
  // resolving. /feedback → /markup tracks the 2026-05-27 rename of the
  // creative review tool's public URL (DB tables stay `review_*`).
  async redirects() {
    return [
      { source: '/proposals/:id/quote-builder',   destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-cover',     destination: '/quotes/:id/cover',    permanent: false },
      { source: '/proposals/:id/quote-design',    destination: '/quotes/:id/settings', permanent: false },
      { source: '/proposals/:id/quote-pricing',   destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-pages',     destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-text-pages',destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-contents',  destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-details',   destination: '/quotes/:id',          permanent: false },
      { source: '/proposals/:id/quote-packages',  destination: '/quotes/:id',          permanent: false },
      { source: '/feedback',                      destination: '/markup',              permanent: true  },
      { source: '/feedback/:path*',               destination: '/markup/:path*',       permanent: true  },
    ];
  },
};

module.exports = nextConfig;
