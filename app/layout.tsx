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
  title: 'AgencyViz',
  description: 'Agency Toolbox by AgencyViz',
  icons: {
    icon: '/favicon.svg',
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