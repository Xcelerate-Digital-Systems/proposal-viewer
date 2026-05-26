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

  // Legacy /proposals/[id]/quote-* URLs forward to the independent /quotes/[id]
  // area. Old bookmarks and email links continue to resolve.
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
    ];
  },
};

module.exports = nextConfig;
