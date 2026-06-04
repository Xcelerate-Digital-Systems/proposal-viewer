import type { Metadata } from 'next';
import { Check, ArrowRight, CaretDown } from '@phosphor-icons/react/dist/ssr';
import { getDefaultPlan } from '@/lib/billing/plan';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { AnimatedPricing } from '@/components/marketing/AnimatedPricing';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { FAQAccordion } from '@/components/marketing/FAQAccordion';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';

export const metadata: Metadata = {
  title: 'Pricing — AgencyViz',
  description:
    'Founding-member pricing for AgencyViz. One plan, every tool, 7-day trial, cancel any time.',
};

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';

const FEATURES = [
  'Unlimited proposals & quotes',
  'Unlimited docs & presentations',
  'Markup creative review',
  'Funnel Planner & Swipe Vault',
  'Reusable template library',
  'Meta + GoHighLevel to Looker Studio',
  'Guest client access, no login',
  'Email + webhook notifications',
];

const INCLUDED = [
  {
    group: 'Pitch',
    items: [
      'Drag-and-drop proposal builder with custom covers',
      'Embedded quotes with line items, packages, and add-ons',
      'Document editor for SOWs, contracts, and onboarding guides',
      'Template library — proposals, pages, packages, and line items',
      'E-signature with Accept / Decline / Request Changes',
      'View analytics — when they opened, pages viewed, time spent',
      'Mobile-responsive branded viewer',
      'Custom domains (proposals.youragency.com)',
    ],
  },
  {
    group: 'Markup',
    items: [
      'Pin comments on images, video, PDFs, email, SMS, and webpages',
      'Drawing annotations — arrows, boxes, and text',
      '8-stage Kanban with guest visibility controls',
      'Per-reviewer approvals with auto-advance',
      'Version history with per-version comments',
      'Whiteboard view with shapes and sticky notes',
      'Stage-scoped notifications',
    ],
  },
  {
    group: 'Funnel Planner',
    items: [
      'Infinite canvas with 60+ node types',
      'Forecast engine — revenue, cost, profit, ROAS',
      'What-if scenarios',
      'Template gallery — Lead Gen, E-commerce, Service, Course',
      'PNG & PDF export',
    ],
  },
  {
    group: 'Swipe Vault',
    items: [
      'Ad library with full metadata (copy, CTA, source URL)',
      '9 persuasion angle tags',
      'Realistic Facebook feed mockup',
      'Video transcription',
      'Folders, boards, and shareable links',
    ],
  },
  {
    group: 'Looker Studio Connector',
    items: [
      '95+ insight fields from Meta Ads',
      'Creative fields — thumbnails, ad copy, CTAs',
      'Breakdowns — age, gender, country, device, placement',
      'Passthrough architecture — no data stored',
      'GoHighLevel two-way CRM sync',
    ],
  },
  {
    group: 'Platform',
    items: [
      'White-label branding — logo, colours, 4 font slots',
      'Custom domains with DNS verification',
      'Team management — Owner, Admin, Member roles',
      'In-app + email + webhook notifications',
      'Row-level security and AES-256-GCM encryption',
      'Onboarding wizard and guided product tours',
    ],
  },
];

const STACK_COMPARISON = [
  { tool: 'Proposal tool', example: 'Proposify', cost: '~$49' },
  { tool: 'Creative review', example: 'Filestage', cost: '~$89' },
  { tool: 'Funnel mapping', example: 'Funnelytics', cost: '~$49' },
  { tool: 'File sharing & docs', example: 'Google Workspace', cost: '~$14' },
];

const FAQS = [
  { q: 'What happens after the 7-day trial?', a: 'Your card is automatically charged at the end of the trial unless you cancel from Settings → Billing. You\'ll get an email 3 days before the trial ends so it\'s never a surprise.' },
  { q: 'Can I switch between monthly and yearly?', a: 'Anytime, straight from your billing portal. Stripe handles the proration.' },
  { q: 'What if I cancel?', a: 'You keep access until the end of your current billing period. Your data sticks around so you can reactivate later if you change your mind.' },
  { q: 'Will the founders price change?', a: 'Not for you. Existing subscribers stay on the founders price for the life of their subscription, even after standard pricing launches at $79/mo.' },
  { q: 'Is there a limit on proposals or team members?', a: 'No. Unlimited proposals, quotes, documents, and team members on every plan.' },
  { q: 'Do my clients need a paid account?', a: 'No. Clients access everything via share links — proposals, reviews, funnels, and more. No signup, no app, no friction.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards via Stripe. Invoicing is available for annual plans on request.' },
];

export default async function PricingPage() {
  const plan = await getDefaultPlan();

  const monthly = plan ? plan.monthly_price_cents / 100 : 49;
  const yearly = plan ? plan.yearly_price_cents / 100 : 490;

  return (
    <div className="bg-white">
      <SiteHeader publicSignupOn={PUBLIC_SIGNUP_ON} />

      <main>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pt-32 md:pt-40 pb-16 md:pb-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ScrollReveal>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal bg-teal/10 rounded-full px-3 py-1 mb-5">
              Founding-member pricing
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-ink tracking-tight mb-4">
              One plan. Everything in.
            </h1>
            <p className="text-lg text-muted max-w-xl mx-auto">
              Lock in our launch pricing for the life of your subscription.
              7-day free trial, card required, cancel any time.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Plan card ────────────────────────────────────── */}
      <section className="pb-20 md:pb-28">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <AnimatedPricing
              planName={plan?.name ?? 'Founders'}
              monthly={monthly}
              yearly={yearly}
              features={FEATURES}
              cta={
                PUBLIC_SIGNUP_ON
                  ? { mode: 'link', href: 'https://app.agencyviz.io/signup', label: 'Start your 7-day free trial' }
                  : { mode: 'node', node: <WaitlistForm source="pricing" /> }
              }
            />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Everything included ──────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Every feature. One price.
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              No tiers, no add-ons, no per-seat pricing. Every feature ships with the founders plan.
            </p>
          </ScrollReveal>
          <ScrollReveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {INCLUDED.slice(0, 3).map(g => (
                <div key={g.group} className="rounded-2xl border border-edge bg-white p-6">
                  <h3 className="text-sm font-semibold text-ink mb-4">{g.group}</h3>
                  <ul className="space-y-2.5">
                    {g.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs text-ink/70 leading-relaxed">
                        <Check size={12} weight="bold" className="text-teal shrink-0 mt-0.5" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <details className="group/feat">
              <summary className="flex items-center justify-center gap-2 text-sm font-medium text-teal cursor-pointer hover:text-primary-hover transition-colors py-4 mt-2 list-none [&::-webkit-details-marker]:hidden">
                <span className="group-open/feat:hidden">Show all features</span>
                <span className="hidden group-open/feat:inline">Show fewer</span>
                <CaretDown size={14} weight="bold" className="shrink-0 group-open/feat:rotate-180 transition-transform duration-200" />
              </summary>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {INCLUDED.slice(3).map(g => (
                  <div key={g.group} className="rounded-2xl border border-edge bg-white p-6">
                    <h3 className="text-sm font-semibold text-ink mb-4">{g.group}</h3>
                    <ul className="space-y-2.5">
                      {g.items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-ink/70 leading-relaxed">
                          <Check size={12} weight="bold" className="text-teal shrink-0 mt-0.5" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Compare the cost ─────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Add up what you&apos;re paying now.
            </h2>
            <p className="mt-4 text-prose max-w-lg mx-auto leading-relaxed">
              A typical agency stack costs $200+/mo, and none of the tools talk to each other.
            </p>
          </ScrollReveal>
          <ScrollReveal>
            <div className="rounded-2xl border border-edge bg-white overflow-hidden">
              <div className="divide-y divide-edge">
                {STACK_COMPARISON.map(s => (
                  <div key={s.tool} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <span className="text-sm font-medium text-ink">{s.tool}</span>
                      <span className="text-xs text-dim ml-2">({s.example})</span>
                    </div>
                    <span className="text-sm font-semibold text-red-500">{s.cost}/mo</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-4 bg-red-50/50">
                  <span className="text-sm font-semibold text-ink">Typical total</span>
                  <span className="text-base font-bold text-red-500">$200+/mo</span>
                </div>
              </div>
              <div className="border-t-2 border-teal/20 bg-teal/[0.03] px-6 py-5 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-ink">AgencyViz</span>
                  <span className="text-xs text-dim ml-2">(everything above + more)</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-teal">${monthly}</span>
                  <span className="text-sm text-dim">/mo</span>
                </div>
              </div>
            </div>
            {PUBLIC_SIGNUP_ON && (
              <p className="mt-8 text-center">
                <a
                  href="https://app.agencyviz.io/signup"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-primary-hover transition-colors"
                >
                  Start your free trial <ArrowRight size={14} weight="bold" />
                </a>
              </p>
            )}
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-2xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Pricing questions, answered.
            </h2>
          </ScrollReveal>
          <ScrollReveal>
            <FAQAccordion items={FAQS} />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="bg-surface-dark relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 80%, rgba(138,217,209,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(1,124,135,0.15) 0%, transparent 45%)',
          }}
        />
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center relative">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              One plan. Every tool.<br className="hidden md:block" /> Locked for life.
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              Founding-member pricing stays at ${monthly}/mo for the life of your subscription. Standard pricing launches at $79/mo.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              {PUBLIC_SIGNUP_ON ? (
                <a
                  href="https://app.agencyviz.io/signup"
                  className="press-scale inline-flex items-center gap-2 h-12 px-7 rounded-lg bg-white text-teal font-semibold hover:bg-white/90 transition-colors"
                >
                  Start your 7-day free trial <ArrowRight size={16} weight="bold" />
                </a>
              ) : (
                <div className="max-w-md w-full">
                  <WaitlistForm source="pricing-cta" />
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
}
