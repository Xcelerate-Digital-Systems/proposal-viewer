// app/layout.tsx
import './globals.css';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { Manrope, Caveat } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AgencyViz',
    template: '%s | AgencyViz',
  },
  description:
    'Create proposals, quotes, and creative review boards that win clients. All the tools your agency needs in one place.',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'AgencyViz',
    description:
      'Create proposals, quotes, and creative review boards that win clients.',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'AgencyViz',
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'AgencyViz',
    description:
      'Create proposals, quotes, and creative review boards that win clients.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${caveat.variable}`}>
      <body className="bg-ivory text-slate-900 min-h-screen overflow-hidden">
        <Suspense fallback={null}>
          <PostHogProvider>
            <ToastProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </ToastProvider>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}