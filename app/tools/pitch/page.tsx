'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, X,
  FileText, Receipt, MonitorPlay, Layout,
  Stack, CursorClick, Palette, Globe, LinkSimple,
  Eye, Copy, PaperPlaneTilt, Lock,
  ChartBar, PenNib, DeviceMobile,
  CheckCircle,
} from '@phosphor-icons/react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { FAQAccordion } from '@/components/marketing/FAQAccordion';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';
const CTA_HREF = PUBLIC_SIGNUP_ON ? 'https://app.agencyviz.io/signup' : '/pricing';
const CTA_LABEL = PUBLIC_SIGNUP_ON ? 'Start free trial' : 'See pricing';

/* ── Data ──────────────────────────────────────────────────── */

const PITCH_TOOLS = [
  { icon: FileText, label: 'Proposals' },
  { icon: Receipt, label: 'Quotes' },
  { icon: MonitorPlay, label: 'Documents' },
  { icon: Layout, label: 'Templates' },
];

const BEFORE = [
  'Proposals in one tool, quotes in a spreadsheet, docs in Google Drive',
  'Clients download PDFs they never open',
  'No idea if the client even looked at it',
  'Every revision is a new email attachment',
];

const AFTER = [
  'Proposals, quotes, and docs live in one workspace',
  'Client opens in the browser — no download, no login',
  'View analytics show exactly when and how far they read',
  'Accept, decline, or request changes in one click',
];

const WORKFLOW_TABS = [
  {
    key: 'build' as const,
    label: 'Build',
    title: 'Drag-and-drop proposal builder.',
    desc: 'Reorder pages, add sections, embed quotes, and pull from your template library. Custom covers, professional layouts, and your brand on every page.',
  },
  {
    key: 'send' as const,
    label: 'Share',
    title: 'One link. No attachments.',
    desc: 'Send a shareable link. Your client opens the proposal in the browser — no login, no download, no friction. Works on desktop, tablet, and mobile.',
  },
  {
    key: 'close' as const,
    label: 'Close',
    title: 'Accept in one click.',
    desc: 'Clients accept with optional e-signature, decline, or request a revision. You get notified the moment they respond. Auto-redirect to payment or booking after acceptance.',
  },
];

const FEATURES = [
  { icon: Stack, title: 'Drag-and-drop page builder', desc: 'Reorder pages, add sections, and build proposals visually.' },
  { icon: Receipt, title: 'Embedded quotes', desc: 'Line-item pricing, packages, and add-ons inside the proposal.' },
  { icon: CursorClick, title: 'Package tiers', desc: 'Present Good/Better/Best packages with a recommended badge.' },
  { icon: Palette, title: 'Custom branding', desc: 'Your logo, colours, fonts on every proposal. Full design control.' },
  { icon: Layout, title: 'Template library', desc: 'Save pages, packages, and full proposals as reusable templates.' },
  { icon: Eye, title: 'View analytics', desc: 'Know when your client opens and how far they read.' },
  { icon: PenNib, title: 'E-signature', desc: 'Draw or type a signature on acceptance. No DocuSign needed.' },
  { icon: Globe, title: 'Custom domains', desc: 'Send proposals from proposals.youragency.com.' },
  { icon: DeviceMobile, title: 'Mobile-responsive viewer', desc: 'Proposals look perfect on desktop, tablet, and mobile.' },
];

const USE_CASES = [
  { title: 'New Business Pitches', desc: 'Build a proposal, embed the quote, and send one link. The client reads it and accepts without a single back-and-forth.', gradient: 'from-sky-100 to-cyan-50' },
  { title: 'Retainer Renewals', desc: 'Clone last quarter\'s proposal, update the scope, and send. Your template library makes renewals a 10-minute job.', gradient: 'from-violet-100 to-purple-50' },
  { title: 'Client Onboarding', desc: 'Share welcome docs, scope decks, and rate cards as live documents the client opens in the browser.', gradient: 'from-amber-100 to-yellow-50' },
];

const FAQS = [
  { q: 'Can I embed a quote inside a proposal?', a: 'Yes. Quotes with line-item pricing, packages, and add-ons live inside the proposal. Clients see and accept everything in one view.' },
  { q: 'Do my clients need an account?', a: 'No. Proposals are shared by link. Clients view, accept, and act without signing up or installing anything.' },
  { q: 'Can I use my own branding?', a: 'Yes. Your logo, colours, fonts, and a custom domain. Every proposal looks like it came from your agency.' },
  { q: 'What happens when a client accepts?', a: 'You get notified immediately. You can auto-redirect them to a payment link, a Calendly booking, or show a custom message.' },
  { q: 'Can I reuse proposals as templates?', a: 'Yes. Save any proposal, page, or quote package as a template. Your team pulls from a shared library for every new pitch.' },
  { q: 'How do I know if a client viewed my proposal?', a: 'View analytics show total views, unique viewers, time spent, pages viewed, device breakdown, and a full view history.' },
  { q: 'Can clients view proposals on mobile?', a: 'Yes. The full-screen branded viewer is mobile-responsive. Clients read and accept proposals from any device.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function PitchPage() {
  const reduce = useReducedMotion();
  const animate = !reduce;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-white">
      <SiteHeader publicSignupOn={PUBLIC_SIGNUP_ON} />

      {/* ── 1. Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[100dvh] bg-gradient-to-br from-[#017C87] via-[#016670] to-[#043946]">
        <div className="absolute inset-0">
          <FloatingPaths position={1} animate={animate} />
          <FloatingPaths position={-1} animate={animate} />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 52% 44% at 50% 44%, rgba(1,124,135,0.4) 0%, transparent 65%)' }}
        />
        <div className="relative z-10 pt-32 md:pt-40 pb-0">
          <div className="max-w-4xl mx-auto px-6 text-center mb-12">
            <ScrollReveal>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 mb-6">
                <FileText size={14} weight="bold" /> Pitch
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Win the pitch<br />
                <span className="text-white/80">before the call ends.</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
                Proposals with embedded quotes, documents clients open in the browser, and
                a shared template library. One link — your client reads it and acts on it.
              </p>
              <div className="mt-8">
                <LiquidButton asChild size="xl" className="text-white font-semibold">
                  <Link href={CTA_HREF} className="gap-2">
                    {CTA_LABEL} <ArrowRight size={16} weight="bold" />
                  </Link>
                </LiquidButton>
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal className="max-w-5xl mx-auto px-2 md:px-16" delay={200}>
            <div
              className="border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-t-[30px] shadow-2xl overflow-hidden"
              style={{ maxHeight: '32rem' }}
            >
              <div className="w-full overflow-hidden rounded-t-2xl bg-white md:p-4 aspect-[16/10]">
                <video
                  src="/video/Pitch-Video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover object-top rounded-t-lg"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Tool bar ─────────────────────────────────────── */}
      <section className="bg-surface-dark py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-wider text-surface-dark-accent/60 mb-6">
              Four tools. One Pitch workspace.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {PITCH_TOOLS.map(t => (
                <div key={t.label} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.07] border border-white/10">
                  <t.icon size={20} weight="duotone" className="text-surface-dark-accent" />
                  <span className="text-sm text-white/80 font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────── */}
      <section className="py-12 md:py-14 border-b border-edge/50">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal">4</div>
                <div className="mt-1 text-sm text-muted">Deliverable types</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal">5</div>
                <div className="mt-1 text-sm text-muted">Template types</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <LinkSimple size={40} weight="bold" />
                </div>
                <div className="mt-1 text-sm text-muted">One link. No login.</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Before / After ───────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Why do you need Pitch?
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              The best agencies close deals with a polished, frictionless experience — not a PDF attachment.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal variant="slide-left">
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">PDF attachments and quote spreadsheets.</h3>
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
              <div className="rounded-2xl border border-teal/20 bg-teal/[0.03] p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">With Pitch</span>
                <h3 className="mt-3 text-xl font-bold text-ink">One link. One polished experience.</h3>
                <ul className="mt-6 space-y-3">
                  {AFTER.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink/70">
                      <Check size={14} weight="bold" className="text-teal shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── How it works (tabs) ──────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">How it works</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Build it. Share a link. Close the deal.
            </h2>
          </ScrollReveal>
          <WorkflowTabs />
        </div>
      </section>

      {/* ── Client experience ────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal variant="slide-left" className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Client experience</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Your client opens a link and acts on it.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                No PDF to download. No account to create. Your client opens a branded, full-screen
                proposal in the browser and accepts it without leaving the page.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <Palette size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Branded cover page sets the tone before they read a word
                </li>
                <li className="flex items-start gap-2.5">
                  <CursorClick size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Accept, decline, or request changes — with optional e-signature
                </li>
                <li className="flex items-start gap-2.5">
                  <Eye size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  View analytics: when they opened, pages viewed, time spent
                </li>
                <li className="flex items-start gap-2.5">
                  <PaperPlaneTilt size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Auto-redirect to payment or booking after acceptance
                </li>
              </ul>
            </ScrollReveal>
            <ScrollReveal variant="slide-right" className="flex-1 w-full" delay={120}>
              <ViewerMockup />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">Features</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Everything you need to close the deal.
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="stagger">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {FEATURES.map(f => (
                <div key={f.title} className="rounded-2xl border border-edge bg-white p-6 hover-lift group">
                  <div className="w-10 h-10 rounded-xl bg-teal/8 flex items-center justify-center mb-4 group-hover:bg-teal/12 transition-colors">
                    <f.icon size={20} weight="duotone" className="text-teal" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">Use cases</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              From first pitch to signed deal.
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="scale">
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map(uc => (
                <div key={uc.title} className="rounded-2xl border border-edge bg-white p-6 hover-lift">
                  <div className={`h-28 rounded-xl bg-gradient-to-br ${uc.gradient} mb-4`} />
                  <h3 className="text-base font-semibold text-ink">{uc.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-2xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">FAQ</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Questions about Pitch?
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
          <ScrollReveal variant="scale">
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              Stop sending proposals<br className="hidden md:block" /> nobody opens.
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              One link. Your client reads it and acts on it. No PDF, no download, no chasing.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              <LiquidButton asChild size="xl" className="text-white font-semibold">
                <Link href={CTA_HREF} className="gap-2">
                  {CTA_LABEL} <ArrowRight size={16} weight="bold" />
                </Link>
              </LiquidButton>
              <LiquidButton asChild size="default" className="text-white font-semibold">
                <Link href="/pricing" className="gap-2">
                  View pricing <ArrowRight size={14} weight="bold" />
                </Link>
              </LiquidButton>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Workflow Tabs ────────────────────────────────────────── */

function WorkflowTabs() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { tabsRef.current[active]?.focus(); }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const len = WORKFLOW_TABS.length;
    if (e.key === 'ArrowRight') setActive(i => (i + 1) % len);
    else if (e.key === 'ArrowLeft') setActive(i => (i - 1 + len) % len);
    else return;
    e.preventDefault();
  };

  return (
    <ScrollReveal>
      <div role="tablist" className="flex items-center justify-center gap-2 md:gap-4 mb-8" onKeyDown={onKeyDown}>
        {WORKFLOW_TABS.map((tab, i) => (
          <button
            key={tab.label}
            ref={el => { tabsRef.current[i] = el; }}
            role="tab"
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={`px-5 md:px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active === i ? 'bg-teal text-white shadow-sm' : 'bg-white text-muted hover:text-ink border border-edge'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="rounded-2xl bg-white border border-edge p-6 md:p-10 shadow-card-soft">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div>
              <h3 className="text-2xl font-bold text-ink">{WORKFLOW_TABS[active].title}</h3>
              <p className="mt-3 text-sm text-prose leading-relaxed">{WORKFLOW_TABS[active].desc}</p>
            </div>
            <div className="rounded-xl border border-edge overflow-hidden shadow-card bg-white aspect-[4/3]">
              <TabMockup variant={WORKFLOW_TABS[active].key} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </ScrollReveal>
  );
}

/* ── Viewer Mockup (client experience) ───────────────────── */

function ViewerMockup() {
  return (
    <div className="rounded-2xl border border-edge bg-white shadow-card-soft overflow-hidden">
      <div className="bg-gradient-to-br from-teal/10 to-primary-tint p-6 md:p-8 text-center border-b border-edge/50">
        <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center mx-auto mb-3">
          <FileText size={20} weight="duotone" className="text-teal" />
        </div>
        <div className="h-3 w-32 bg-ink/10 rounded mx-auto mb-2" />
        <div className="h-2 w-20 bg-ink/5 rounded mx-auto" />
      </div>
      <div className="p-5 md:p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-2.5 w-3/4 bg-ink/8 rounded" />
          <div className="h-2 w-full bg-ink/4 rounded" />
          <div className="h-2 w-5/6 bg-ink/4 rounded" />
        </div>
        <div className="h-16 rounded-lg bg-gradient-to-r from-teal/5 to-teal-tint border border-teal/10" />
        <div className="flex items-center justify-between pt-2 border-t border-edge/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[9px] text-muted">
              <Eye size={10} /> 3 views
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted">
              <ChartBar size={10} /> 4m avg
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[8px] font-semibold flex items-center gap-1">
              <Check size={8} weight="bold" /> Accept
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface border border-edge text-[8px] font-medium text-muted">
              Request changes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Floating Paths (hero background) ────────────────────── */

function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.7 + i * 0.05,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      <svg className="w-full h-full" viewBox="0 0 696 316" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        {paths.map(p => (
          <motion.path
            key={p.id} d={p.d} stroke="currentColor" strokeWidth={p.width}
            strokeOpacity={0.1 + p.id * 0.022}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={animate
              ? { pathLength: 1, opacity: [0.4, 0.75, 0.4], pathOffset: [0, 1, 0] }
              : { pathLength: 1, opacity: 0.55 }}
            transition={animate
              ? { duration: 20 + (p.id % 8) * 2.5, repeat: Infinity, ease: 'linear' }
              : { duration: 0 }}
          />
        ))}
      </svg>
    </div>
  );
}

/* ── Tab Mockups ─────────────────────────────────────────── */

function TabMockup({ variant }: { variant: 'build' | 'send' | 'close' }) {
  if (variant === 'build') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="flex gap-3 w-full max-w-[90%]">
        <div className="w-1/3 space-y-2">
          {['Cover', 'About', 'Strategy', 'Quote'].map((p, i) => (
            <div key={p} className={`px-2 py-1.5 rounded text-[8px] ${i === 0 ? 'bg-teal/8 text-teal' : 'bg-surface text-muted'}`}>{p}</div>
          ))}
        </div>
        <div className="flex-1 bg-white rounded-lg border border-edge p-3 space-y-2">
          <div className="h-3 w-24 bg-ink/10 rounded" />
          <div className="h-1.5 w-full bg-ink/5 rounded" />
          <div className="h-1.5 w-3/4 bg-ink/5 rounded" />
          <div className="h-12 rounded bg-gradient-to-r from-teal/5 to-teal-tint border border-teal/10 mt-2" />
        </div>
      </div>
    </div>
  );

  if (variant === 'send') return (
    <div className="h-full bg-paper flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border border-edge p-5 max-w-[70%] text-center space-y-3 shadow-card">
        <div className="w-8 h-8 rounded-full bg-teal/10 mx-auto flex items-center justify-center">
          <PaperPlaneTilt size={14} className="text-teal" />
        </div>
        <div className="h-2.5 w-32 bg-ink/10 rounded mx-auto" />
        <div className="h-1.5 w-48 bg-ink/5 rounded mx-auto" />
        <div className="h-8 w-28 rounded-lg bg-teal mx-auto" />
      </div>
    </div>
  );

  return (
    <div className="h-full bg-paper flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border border-edge p-5 max-w-[70%] text-center space-y-3 shadow-card">
        <div className="w-10 h-10 rounded-full bg-emerald-50 mx-auto flex items-center justify-center">
          <Check size={18} className="text-emerald-500" />
        </div>
        <div className="h-2.5 w-28 bg-ink/10 rounded mx-auto" />
        <div className="h-1.5 w-40 bg-ink/5 rounded mx-auto" />
        <div className="flex justify-center gap-2 mt-2">
          <div className="h-7 w-20 rounded-lg bg-emerald-500" />
          <div className="h-7 w-20 rounded-lg bg-surface border border-edge" />
        </div>
      </div>
    </div>
  );
}
