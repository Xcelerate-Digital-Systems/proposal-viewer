import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Check, X, FileText,
  FlowArrow, BookmarkSimple, ChatDots, Plug,
} from '@phosphor-icons/react/dist/ssr';
import { getDefaultPlan } from '@/lib/billing/plan';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { AnimatedHero } from '@/components/marketing/AnimatedHero';
import { AnimatedPricing } from '@/components/marketing/AnimatedPricing';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { ContainerScroll } from '@/components/marketing/ContainerScroll';
import { FAQAccordion } from '@/components/marketing/FAQAccordion';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { LiquidCTA } from '@/components/marketing/LiquidCTA';

export const metadata: Metadata = {
  title: 'AgencyViz - The Agency Toolbox',
  description:
    'Proposals, quotes, presentations, plans, and creative review. Everything your clients see, in one place.',
};

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';

/* ── Data ──────────────────────────────────────────────────── */

const BEFORE = [
  'Proposals in one tool, quotes in a spreadsheet',
  'Creative feedback buried in email threads',
  'Clients download PDFs they never open',
  'Campaign plans scattered across docs and slides',
  'No single source of truth for revisions',
];

const AFTER = [
  'Proposals, quotes, and docs in one branded workspace',
  'Creative feedback pinned on the actual asset',
  'Clients open one link, no app, no PDF, no login',
  'Campaign plans on an infinite canvas',
  'Every revision tracked from draft to approval',
];

const PITCH_BULLETS = [
  'Proposals with drag-and-drop pages, custom covers, and professional layouts',
  'Quotes with line-item pricing, packages, and add-ons. Accept online.',
  'Documents and presentations clients open in the browser, not a PDF',
  'Reusable template library so nothing gets built from scratch',
];

const MARKUP_BULLETS = [
  'Pin feedback on images, video, PDFs, emails, and webpages',
  'Kanban board from draft to approval with stage-based workflows',
  'Assign revisions to teammates and track them to done',
  'Version history and per-reviewer sign-off on every round',
];

const SECONDARY = [
  { icon: FlowArrow, title: 'Funnel Planner', desc: 'Build campaign funnels on an infinite canvas with 60+ node types. The built-in forecast engine calculates projected revenue, cost, profit, and ROAS before you spend a dollar.', bullets: ['60+ node types for any campaign', 'Built-in revenue & ROAS forecast', 'What-if scenarios to compare strategies'], href: '/tools/funnel-planner', accent: 'from-teal/6 to-cyan-50/40', iconBg: 'bg-teal/8 group-hover:bg-teal/12' },
  { icon: BookmarkSimple, title: 'Swipe Vault', desc: 'Save ads with the creative, the copy, and the metadata. Tag by persuasion angle. Every save gets a realistic Facebook feed mockup your whole team draws from.', bullets: ['9 persuasion angle tags', 'Realistic Facebook feed mockup', 'Shared team library with video transcription'], href: '/tools/swipe-vault', accent: 'from-amber-50/60 to-orange-50/30', iconBg: 'bg-amber-100/60 group-hover:bg-amber-100/80' },
  { icon: Plug, title: 'Looker Studio Connector', desc: 'Connect Meta to Looker Studio and pull 95+ fields live: spend, clicks, ROAS, creative thumbnails, and breakdowns. No data stored. No CSV exports.', bullets: ['95+ insight fields from Meta', 'Passthrough, zero data retention', 'GoHighLevel two-way CRM sync'], href: '/tools/integrations', accent: 'from-violet-50/50 to-indigo-50/30', iconBg: 'bg-violet-100/50 group-hover:bg-violet-100/70' },
];

const STEPS = [
  { title: 'Build', desc: 'Start from a template. Proposals, quotes, docs, plans, and review boards come together in minutes.' },
  { title: 'Share', desc: 'Send one link. Your client opens it in the browser, no account, no download, no friction.' },
  { title: 'Sign off', desc: 'They accept, comment, and approve. You track every revision to done in one place.' },
];

const FAQS = [
  { q: 'Who is AgencyViz for?', a: 'Marketing and creative agencies that pitch clients, run creative through revisions, and want every client touchpoint to look like them, not like a mishmash of third-party tools.' },
  { q: 'Do my clients need an account?', a: 'No. Proposals, quotes, docs, plans, and review boards are shared by link. Clients view, comment, and approve without signing up or installing anything.' },
  { q: 'Does everything work in the browser?', a: 'Yes. Clients open everything straight in the browser. No app to install, no PDF to download, no login to create.' },
  { q: 'What can clients review in Markup?', a: 'Images, video, PDFs, emails, SMS, webpages, and Google Ads. Clients pin feedback exactly where it belongs and approve each version.' },
  { q: 'How do the integrations work?', a: 'Connect Meta and GoHighLevel, and the data flows into your Looker Studio reports. AgencyViz is the pipe; your report stays yours.' },
  { q: 'Is my data secure?', a: 'Everything sits behind row-level security policies and access tokens are encrypted with AES-256-GCM. Your data stays in your workspace.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default async function HomePage() {
  const plan = await getDefaultPlan();
  const monthly = plan ? plan.monthly_price_cents / 100 : 49;
  const yearly = plan ? plan.yearly_price_cents / 100 : 490;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-white scroll-smooth">
      {/* ── Header ──────────────────────────────────────────── */}
      <SiteHeader
        publicSignupOn={PUBLIC_SIGNUP_ON}
        anchors={[
          { label: 'Features', href: '#tools' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'FAQ', href: '#faq' },
        ]}
      />

      {/* ── Hero ────────────────────────────────────────────── */}
      <AnimatedHero publicSignupOn={PUBLIC_SIGNUP_ON} />

      {/* ── Product showcase (scroll animation) ─────────────── */}
      <section className="bg-surface/40 border-b border-edge/50 overflow-hidden py-[6rem]">
        <ContainerScroll
          titleComponent={
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-ink tracking-tight">
              From pitch to approval,<br />
              <span className="text-teal">one workspace.</span>
            </h2>
          }
        >
          <video
            src="/video/HomePage Video.mp4"
            poster="/video/homepage-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover rounded-2xl"
          />
        </ContainerScroll>
      </section>

      {/* ── Before vs After ─────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Your new toolkit for client delivery.
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              Stop stitching together tools that don&apos;t talk to each other.
              AgencyViz is the single workspace where your team builds and your clients engage.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal variant="slide-left">
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">The duct-taped stack</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Five subscriptions, five logins, and a group chat full of &ldquo;did you see my feedback?&rdquo;
                </p>
                <ul className="mt-6 space-y-3">
                  {BEFORE.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink/70">
                      <X size={14} weight="bold" className="text-red-400 shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="slide-right" delay={100}>
              <div className="rounded-2xl border border-surface-dark-border bg-surface-dark p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-surface-dark-accent">With AgencyViz</span>
                <h3 className="mt-3 text-xl font-bold text-white">One workspace. Both sides.</h3>
                <p className="mt-2 text-sm text-surface-dark-accent/50 leading-relaxed">
                  Everything your team builds and everything your client sees, in one place.
                </p>
                <ul className="mt-6 space-y-3">
                  {AFTER.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check size={14} weight="bold" className="text-surface-dark-accent shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Deep dive: Pitch ────────────────────────────────── */}
      <section id="tools" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal variant="slide-left" className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Pitch</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Win the pitch before the call ends.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                Build proposals with embedded quotes, share documents as live presentations,
                and pull from a shared template library. One link. Your client opens it,
                reads it, and acts on it.
              </p>
              <ul className="mt-6 space-y-3">
                {PITCH_BULLETS.map(b => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
                    <Check size={16} weight="bold" className="text-teal shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal variant="slide-right" className="flex-1 w-full" delay={120}>
              <div className="hidden md:block">
                <MockAppFrame label="app.agencyviz.io/proposals">
                  <MockProposalUI />
                </MockAppFrame>
              </div>
              <div className="md:hidden rounded-2xl border border-edge bg-surface/60 p-6 text-center">
                <p className="text-sm text-prose">Drag-and-drop proposal builder with custom covers, embedded quotes, and live browser sharing.</p>
                <p className="mt-3 text-xs text-dim">Desktop workspace preview</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Deep dive: Markup ───────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row-reverse gap-12 lg:gap-16 items-center">
            <ScrollReveal variant="slide-right" className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Markup</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Feedback that lands where it belongs.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                No more &ldquo;the headline on the third one&rdquo; in a forwarded email. Clients pin
                feedback straight onto the creative, you assign the fix, and
                everyone watches it move to done.
              </p>
              <ul className="mt-6 space-y-3">
                {MARKUP_BULLETS.map(b => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
                    <Check size={16} weight="bold" className="text-teal shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal variant="slide-left" className="flex-1 w-full">
              <div className="hidden md:block">
                <MockAppFrame label="app.agencyviz.io/campaigns">
                  <MockMarkupUI />
                </MockAppFrame>
              </div>
              <div className="md:hidden rounded-2xl border border-edge bg-surface/60 p-6 text-center">
                <p className="text-sm text-prose">Kanban board with pin feedback, stage-based workflows, and per-reviewer sign-off.</p>
                <p className="mt-3 text-xs text-dim">Desktop workspace preview</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Secondary tools ─────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Three more tools. Same workspace.
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              Plan campaigns, research what works, and report on performance without leaving AgencyViz.
            </p>
          </ScrollReveal>
          <ScrollReveal variant="stagger" className="grid md:grid-cols-3 gap-5">
            {SECONDARY.map(s => (
              <div key={s.title} className="rounded-2xl border border-edge bg-white hover-lift group flex flex-col overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${s.accent}`} />
                <div className="p-7 pt-5 flex flex-col flex-1">
                  <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center mb-5 transition-colors`}>
                    <s.icon size={22} weight="duotone" className="text-teal" />
                  </div>
                  <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2.5 text-sm text-muted leading-relaxed">{s.desc}</p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {s.bullets.map((b: string) => (
                      <li key={b} className="flex items-start gap-2 text-xs text-ink/70">
                        <Check size={12} weight="bold" className="text-teal shrink-0 mt-0.5" /> {b}
                      </li>
                    ))}
                  </ul>
                  <Link href={s.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-teal/80 transition-colors py-1.5">
                    Learn more <ArrowRight size={14} weight="bold" />
                  </Link>
                </div>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              From kickoff to sign-off in three steps.
            </h2>
          </ScrollReveal>
          <ScrollReveal stagger className="relative grid md:grid-cols-3 gap-12 md:gap-8">
            <div className="hidden md:block absolute top-5 left-[16.7%] right-[16.7%] h-px bg-edge" />
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="w-10 h-10 rounded-full bg-teal text-white flex items-center justify-center text-sm font-bold mx-auto mb-4 relative z-10">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Pricing teaser ──────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              One plan. Every tool.
            </h2>
            <p className="mt-4 text-prose max-w-lg mx-auto">
              Founding-member pricing, locked for the life of your subscription.
            </p>
          </ScrollReveal>

          <ScrollReveal variant="scale">
            <AnimatedPricing
              compact
              planName={plan?.name ?? 'Founders'}
              monthly={monthly}
              yearly={yearly}
              features={['Proposals & quotes', 'Docs & templates', 'Markup review', 'Funnel Planner', 'Swipe Vault', 'Looker integrations']}
              cta={
                PUBLIC_SIGNUP_ON
                  ? { mode: 'link', href: 'https://app.agencyviz.io/signup', label: 'Start your free trial' }
                  : { mode: 'link', href: '/pricing', label: 'See full pricing' }
              }
            />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Quick answers (inline, pre-FAQ) ─────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal className="grid md:grid-cols-3 gap-6 md:gap-8">
            <div>
              <h3 className="text-sm font-semibold text-ink">Do clients need an account?</h3>
              <p className="mt-2 text-sm text-prose leading-relaxed">No. Everything is shared by link. Clients view, comment, and approve without signing up.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Does it work in the browser?</h3>
              <p className="mt-2 text-sm text-prose leading-relaxed">Yes. No app to install, no PDF to download, no login to create. Desktop, tablet, and mobile.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Is my data secure?</h3>
              <p className="mt-2 text-sm text-prose leading-relaxed">Row-level security policies on every table. Access tokens encrypted with AES-256-GCM.</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-28 border-t border-edge/50">
        <div className="max-w-2xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Questions, answered.
            </h2>
          </ScrollReveal>
          <ScrollReveal>
            <FAQAccordion items={FAQS} />
          </ScrollReveal>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="bg-surface-dark relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 80%, rgba(138,217,209,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(1,124,135,0.15) 0%, transparent 45%)',
          }}
        />
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center relative">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Put your whole client experience in one place.
            </h2>
            <p className="mt-5 text-base md:text-lg text-surface-dark-accent/60 max-w-lg mx-auto leading-relaxed">
              Join the agencies running every client touchpoint through AgencyViz.
            </p>
            <div className="mt-10">
              {PUBLIC_SIGNUP_ON ? (
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <LiquidCTA href="https://app.agencyviz.io/signup">
                    Start your 7-day free trial
                  </LiquidCTA>
                  <LiquidCTA href="/pricing">
                    See pricing
                  </LiquidCTA>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-white/50 mb-5">Be first in when we open doors. One email, your invite link.</p>
                  <WaitlistForm source="home-cta" />
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}

/* ── Mock app frame ────────────────────────────────────────── */

function MockAppFrame({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-edge overflow-hidden shadow-card bg-white">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-edge/60 bg-paper">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF605C]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD44]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#00CA4E]" />
        {label && (
          <div className="ml-3 flex-1 max-w-[200px] h-5 bg-surface rounded-md flex items-center px-2">
            <span className="text-[9px] text-faint truncate">{label}</span>
          </div>
        )}
      </div>
      <div className="aspect-[16/10]">{children}</div>
    </div>
  );
}

/* ── Mock proposal editor (matches real ProposalDetailHeader + page sidebar) ── */

function MockProposalUI() {
  const pages = ['Cover Page', 'About Us', 'Our Approach', 'Timeline', 'Investment'];
  const tabs = ['Pages', 'Cover', 'Design', 'Details', 'Pricing'];
  return (
    <div className="flex flex-col h-full bg-white text-ink">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] md:text-xs font-semibold truncate">Q4 Brand Refresh Proposal</span>
          <span className="hidden md:inline text-[8px] text-faint">Draft</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="px-2 py-1 rounded-md border border-edge text-[8px] text-muted">Preview</div>
          <div className="px-2 py-1 rounded-md bg-teal text-white text-[8px] font-medium">Send</div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-3 md:px-4 border-b border-edge shrink-0">
        {tabs.map((t, i) => (
          <div key={t} className={`px-2 md:px-2.5 py-1.5 text-[8px] md:text-[9px] font-medium border-b-2 ${
            i === 0 ? 'border-teal text-teal' : 'border-transparent text-faint'
          }`}>{t}</div>
        ))}
      </div>
      {/* Body: page list + editor */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-[28%] border-r border-edge p-2.5 bg-white space-y-1 overflow-hidden">
          {pages.map((page, i) => (
            <div key={page} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[8px] md:text-[9px] ${
              i === 0 ? 'bg-teal/8 text-teal font-medium' : 'text-muted'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-sm ${i === 0 ? 'bg-teal/30' : 'bg-edge'}`} />
              {page}
            </div>
          ))}
        </div>
        <div className="flex-1 bg-paper p-4 overflow-hidden">
          <div className="max-w-[88%] mx-auto">
            <div className="h-3 w-32 bg-ink/10 rounded mb-2.5" />
            <div className="space-y-1.5">
              <div className="h-1.5 w-full bg-ink/5 rounded" />
              <div className="h-1.5 w-4/5 bg-ink/5 rounded" />
              <div className="h-1.5 w-11/12 bg-ink/5 rounded" />
            </div>
            <div className="mt-4 h-16 rounded-lg bg-gradient-to-br from-teal/5 via-teal-tint to-primary-tint border border-teal/10" />
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-3/4 bg-ink/5 rounded" />
              <div className="h-1.5 w-full bg-ink/5 rounded" />
              <div className="h-1.5 w-2/3 bg-ink/5 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mock markup kanban (matches real KanbanBoard + ProjectTabs) ── */

function MockMarkupUI() {
  const kanbanCols = [
    { label: 'Draft', dot: 'bg-muted', cards: [
      { thumb: 'from-blue-100 to-blue-50', title: 'Email Header' },
    ]},
    { label: 'Internal Review', dot: 'bg-amber-400', cards: [
      { thumb: 'from-teal-100 to-cyan-50', title: 'FB Ad v2' },
      { thumb: 'from-rose-100 to-orange-50', title: 'IG Story' },
    ]},
    { label: 'Client Review', dot: 'bg-blue-400', cards: [
      { thumb: 'from-sky-100 to-cyan-50', title: 'Hero Banner' },
    ]},
    { label: 'Approved', dot: 'bg-emerald-400', cards: [
      { thumb: 'from-teal-100 to-emerald-50', title: 'Logo v3' },
      { thumb: 'from-amber-100 to-yellow-50', title: 'Email v2' },
    ]},
  ];
  return (
    <div className="flex flex-col h-full bg-white text-ink overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0">
        <span className="text-[9px] md:text-[10px] font-semibold truncate">Brand Campaign Q4</span>
        <div className="ml-auto px-1.5 py-0.5 rounded-md bg-teal text-white text-[7px] font-medium">+ Add Asset</div>
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-3 border-b border-edge shrink-0">
        {['Kanban', 'Board', 'Assets', 'Comments'].map((t, i) => (
          <div key={t} className={`px-2 py-1.5 text-[7px] md:text-[8px] font-medium border-b-2 ${
            i === 0 ? 'border-teal text-teal' : 'border-transparent text-faint'
          }`}>{t}</div>
        ))}
      </div>
      {/* Kanban */}
      <div className="flex-1 flex gap-2 p-2 md:p-3 overflow-hidden">
        {kanbanCols.map(col => (
          <div key={col.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1.5 px-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
              <span className="text-[7px] md:text-[8px] font-semibold truncate">{col.label}</span>
              <span className="text-[6px] text-faint ml-auto">{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map(card => (
                <div key={card.title} className="rounded-lg bg-white border border-edge/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className={`h-7 md:h-10 bg-gradient-to-br ${card.thumb}`} />
                  <div className="px-1.5 py-1">
                    <div className="text-[7px] md:text-[8px] font-medium truncate">{card.title}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-teal/20 to-primary-tint border border-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

