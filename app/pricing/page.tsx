// app/pricing/page.tsx
//
// Public marketing surface. Server component — fetches the live Founders
// plan row at render time so updating the plan in the DB updates the page.
// When PUBLIC_SIGNUP_ENABLED is off (today), the CTA is a waitlist email
// capture; flipping it to true switches the CTA to "Start free trial"
// pointed at /login?signup=1 with no code change here.

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { buttonClasses } from '@/components/ui/buttonClasses';
import { getDefaultPlan } from '@/lib/billing/plan';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';

export const metadata: Metadata = {
  title: 'Pricing — AgencyViz',
  description:
    'Founding-member pricing for AgencyViz. One plan, 7-day trial, cancel any time.',
};

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';

const FEATURES = [
  'Unlimited proposals & quotes',
  'Unlimited documents',
  'Unlimited client review projects',
  'Whiteboards + creative feedback tools',
  'Brand-coloured client viewer',
  'Looker Studio integration (Meta Ads)',
  '100 AI generations per day',
  'Email + webhook notifications',
  'Custom domain (optional)',
];

export default async function PricingPage() {
  const plan = await getDefaultPlan();

  const monthly = plan ? plan.monthly_price_cents / 100 : 49;
  const yearly = plan ? plan.yearly_price_cents / 100 : 490;
  const yearlySavingsMonths = Math.max(
    0,
    Math.round(((monthly * 12 - yearly) / monthly) * 10) / 10,
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-edge">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/home" className="inline-flex">
            <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-7" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="text-teal font-medium">
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

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal bg-teal/10 rounded-full px-3 py-1 mb-5">
            Founding-member pricing
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold text-ink tracking-tight mb-4">
            One plan. Everything in.
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto">
            Lock in our launch pricing for the life of your subscription.
            7-day free trial, card required, cancel any time.
          </p>
        </div>

        {/* Plan card */}
        <section className="bg-white border border-edge rounded-3xl shadow-card overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-edge">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-semibold text-ink">
                {plan?.name ?? 'Founders'}
              </h2>
              <span className="text-2xs uppercase tracking-wider text-faint font-semibold">
                Limited
              </span>
            </div>
            <p className="text-sm text-muted mt-1">
              For agencies who join before standard pricing launches.
            </p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-5xl font-semibold text-ink leading-none">
                ${formatPrice(monthly)}
              </span>
              <span className="text-base text-muted">/ month</span>
            </div>
            <p className="text-xs text-muted mt-2">
              or <strong className="text-ink">${formatPrice(yearly)}</strong> billed
              yearly{yearlySavingsMonths > 0 && ` — save ${yearlySavingsMonths} ${yearlySavingsMonths === 1 ? 'month' : 'months'}`}.
            </p>

            <div className="mt-7">
              {PUBLIC_SIGNUP_ON ? (
                <a
                  href="https://app.agencyviz.io/login?signup=1"
                  className={buttonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}
                >
                  Start your 7-day free trial
                  <ArrowRight size={16} />
                </a>
              ) : (
                <WaitlistForm source="pricing" />
              )}
            </div>
          </div>

          <div className="px-8 py-6 bg-surface">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint mb-4">
              What&apos;s included
            </h3>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink">
                  <Check size={16} className="text-teal shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 grid sm:grid-cols-2 gap-x-10 gap-y-8">
          <Faq
            q="What happens after the 7-day trial?"
            a="Your card is automatically charged at the end of the trial unless you cancel from Settings → Billing. You'll get an email 3 days before the trial ends so it's never a surprise."
          />
          <Faq
            q="Can I switch between monthly and yearly?"
            a="Anytime, straight from your billing portal. Stripe handles the proration."
          />
          <Faq
            q="What if I cancel?"
            a="You keep access until the end of your current billing period. Your data sticks around so you can reactivate later if you change your mind."
          />
          <Faq
            q="Will the founders price change?"
            a="Not for you. Existing subscribers stay on the founders price for the life of their subscription, even after standard pricing launches at $79/mo."
          />
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-faint border-t border-edge mt-8">
        <span>&copy; {new Date().getFullYear()} Xcelerate Digital Systems</span>
        <div className="flex items-center gap-4">
          <Link href="/home" className="hover:text-teal transition-colors">
            Home
          </Link>
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

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink mb-1">{q}</h4>
      <p className="text-sm text-muted leading-relaxed">{a}</p>
    </div>
  );
}

function formatPrice(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}
