import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/buttonClasses';

export const metadata: Metadata = {
  title: 'AgencyViz — Agency Toolbox',
  description:
    'AgencyViz is a B2B software platform for agencies: proposals, feedback, ad tracking, and reporting integrations.',
};

export default function HomePage() {
  return (
    <div className="h-screen bg-surface overflow-y-auto">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="text-muted hover:text-teal transition-colors">
              Pricing
            </Link>
            <Link href="/privacy-policy" className="text-muted hover:text-teal transition-colors">
              Privacy
            </Link>
            <Link href="/terms-and-conditions" className="text-muted hover:text-teal transition-colors">
              Terms
            </Link>
            <a
              href="https://app.agencyviz.io/login"
              className={buttonClasses({ variant: 'primary', size: 'sm' })}
            >
              Sign in
              <ArrowRight size={14} />
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-20 text-center">
        <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-10 mx-auto mb-10" />
        <h1 className="text-4xl md:text-5xl font-semibold text-ink tracking-tight mb-5">
          The agency toolbox.
        </h1>
        <p className="text-lg text-muted max-w-xl mx-auto mb-10">
          Proposals, feedback, ad tracking, and reporting integrations &mdash; in one place for agencies
          and their clients.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/pricing"
            className={buttonClasses({ variant: 'primary', size: 'lg' })}
          >
            See pricing
            <ArrowRight size={16} />
          </Link>
          <a
            href="https://app.agencyviz.io/login"
            className={buttonClasses({ variant: 'secondary', size: 'lg' })}
          >
            Sign in
          </a>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-faint border-t border-gray-100 mt-8">
        <span>&copy; {new Date().getFullYear()} Xcelerate Digital Systems</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy-policy" className="hover:text-teal transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-and-conditions" className="hover:text-teal transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>
      </footer>
    </div>
  );
}
