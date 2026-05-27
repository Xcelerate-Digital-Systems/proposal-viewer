// app/layout.tsx
import './globals.css';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { Outfit, Caveat } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

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
    <html lang="en" className={`${outfit.variable} ${caveat.variable}`}>
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