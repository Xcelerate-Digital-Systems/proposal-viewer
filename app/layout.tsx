import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Proposal Viewer',
  description: 'Professional proposal viewer by Xcelerate Digital Systems',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
