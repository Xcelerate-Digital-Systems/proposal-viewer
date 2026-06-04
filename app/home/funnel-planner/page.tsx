'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, X,
  FlowArrow, Globe, ShareNetwork, Presentation,
  CursorClick, Stack, Envelope,
  Lightning, LinkSimple, ChartBar,
  Calculator, CopySimple, Layout, Keyboard,
  Export, Note, TreeStructure,
  Eye,
} from '@phosphor-icons/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { FAQAccordion } from '@/components/marketing/FAQAccordion';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';
const CTA_HREF = PUBLIC_SIGNUP_ON ? 'https://app.agencyviz.io/signup' : '/pricing';
const CTA_LABEL = PUBLIC_SIGNUP_ON ? 'Start free trial' : 'See pricing';

/* ── Data ──────────────────────────────────────────────────── */

const NODE_TYPES = [
  { icon: Globe, label: 'Landing Pages' },
  { icon: Envelope, label: 'Email & SMS' },
  { icon: CursorClick, label: 'Ads & Traffic' },
  { icon: TreeStructure, label: 'Decisions' },
  { icon: Lightning, label: 'Automations' },
  { icon: Note, label: 'Sticky Notes' },
];

const BEFORE = [
  'Campaign funnels live in PowerPoints nobody updates',
  'No way to show clients how the numbers connect',
  'Each revision means rebuilding a deck from scratch',
  'The strategy doc dies after the kickoff call',
];

const AFTER = [
  'Visual funnel on an infinite canvas with smart alignment',
  'Projected revenue, cost, profit, and ROAS calculated live',
  'Duplicate as what-if scenarios and compare strategies',
  'Client sees the full strategy and forecast in the browser',
];

const WORKFLOW_TABS = [
  {
    key: 'build' as const,
    label: 'Build',
    title: 'Drag nodes onto the canvas.',
    desc: 'Map the full campaign from first touchpoint to conversion. Drag ad placements, landing pages, emails, automations, and decision nodes onto an infinite canvas and connect them.',
  },
  {
    key: 'forecast' as const,
    label: 'Forecast',
    title: 'See the numbers before you spend.',
    desc: 'Plug in metrics per step — traffic volume, CPC, conversion rates, and offer values. The engine calculates projected revenue, cost, profit, and ROAS. Toggle the Numbers Layer on and off for clean presentations.',
  },
  {
    key: 'share' as const,
    label: 'Share',
    title: 'The funnel is the presentation.',
    desc: 'Send a shareable link. Your client opens the funnel in the browser, zooms in, and sees the full strategy and forecast. No slides to build — the funnel is the deck.',
  },
];

const FEATURES = [
  { icon: FlowArrow, title: 'Visual funnel builder', desc: 'Drag-and-drop on an infinite canvas with smart alignment guides.' },
  { icon: Stack, title: '60+ node types', desc: 'Traffic sources, pages, offers, decisions, automations, and sticky notes.' },
  { icon: Calculator, title: 'Forecast engine', desc: 'Projected revenue, cost, profit, and ROAS from per-step metrics.' },
  { icon: Eye, title: 'Numbers Layer', desc: 'Toggle the forecast overlay on and off for clean presentations.' },
  { icon: CopySimple, title: 'What-if scenarios', desc: 'Duplicate any funnel and compare strategies side by side.' },
  { icon: Layout, title: 'Template gallery', desc: 'Start from Lead Gen, E-commerce, Service, or Course templates.' },
  { icon: LinkSimple, title: 'Public viewer', desc: 'Share a link. Client sees the funnel and forecast in the browser.' },
  { icon: Export, title: 'PNG & PDF export', desc: 'Export as image or PDF for decks and documents.' },
  { icon: Keyboard, title: 'Keyboard shortcuts', desc: 'Cmd-Z undo, Cmd-D duplicate. Power-user speed.' },
];

const USE_CASES = [
  { title: 'Campaign Planning', desc: 'Map the full campaign from ad to conversion. Plug in real metrics and see projected returns before you spend a dollar.', gradient: 'from-sky-100 to-cyan-50' },
  { title: 'Client Strategy Presentations', desc: 'Walk the client through the plan on a call. The funnel is the deck — no slides to build. Share the link for async review.', gradient: 'from-violet-100 to-purple-50' },
  { title: 'Budget Forecasting', desc: 'Run what-if scenarios with different conversion rates and budgets. Compare strategies side by side before committing spend.', gradient: 'from-emerald-100 to-teal-50' },
];

const FAQS = [
  { q: 'Can clients see the funnel?', a: 'Yes. Share a link and the client opens the funnel in the browser. They can zoom, pan, and see every step and forecast number.' },
  { q: 'How does the forecast work?', a: 'Input metrics per step — traffic volume, CPC, conversion rates, and offer values. The engine runs a topological forward pass and calculates projected revenue, cost, profit, and ROAS.' },
  { q: 'What node types are available?', a: 'Traffic sources, landing pages, forms, offers, emails, SMS, automations, decisions, waits, goals, and 30+ shapes. Plus sticky notes for context.' },
  { q: 'Can I compare different strategies?', a: 'Yes. Duplicate any funnel as a what-if scenario. Compare side by side with different conversion rates or budgets.' },
  { q: 'Can I start from a template?', a: 'Yes. Lead Gen, Sales, E-commerce, Service, and Course templates get you started fast.' },
  { q: 'Can I export the funnel?', a: 'Yes. PNG and PDF export. Drop it into a deck, attach it to a proposal, or share the link directly.' },
  { q: 'What currencies are supported?', a: 'Six currency options and three period options (one-off, monthly, yearly) for localised forecasts.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function FunnelPlannerPage() {
  const reduce = useReducedMotion();
  const animate = !reduce;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-white">
      <SiteHeader publicSignupOn={PUBLIC_SIGNUP_ON} />

      {/* ── 1. Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <FloatingPaths position={1} animate={animate} />
          <FloatingPaths position={-1} animate={animate} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/30 to-white pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 52% 44% at 50% 44%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 45%, transparent 75%)' }}
        />
        <div className="relative z-10 pt-32 md:pt-40 pb-0">
          <div className="max-w-4xl mx-auto px-6 text-center mb-12">
            <ScrollReveal>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal bg-teal/8 rounded-full px-3.5 py-1.5 mb-6">
                <FlowArrow size={14} weight="bold" /> Funnel Planner
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink tracking-tight leading-[1.1]">
                Map the strategy.<br />
                <span className="text-teal">Forecast the numbers.</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-prose max-w-2xl mx-auto leading-relaxed">
                Build campaign funnels on an infinite canvas, plug in real metrics, and see projected
                revenue, cost, profit, and ROAS before the campaign launches. Share the whole picture with one link.
              </p>
              <div className="mt-8">
                <Link href={CTA_HREF} className="press-scale inline-flex items-center gap-2 h-12 px-7 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
                  {CTA_LABEL} <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal className="max-w-5xl mx-auto px-2 md:px-16" delay={200}>
            <div
              className="border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-t-[30px] shadow-2xl overflow-hidden"
              style={{ maxHeight: '32rem' }}
            >
              <div className="w-full overflow-hidden rounded-t-2xl bg-white md:p-4 aspect-[16/10]">
                <MockFunnelUI />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Node types ───────────────────────────────────── */}
      <section className="bg-surface-dark py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-wider text-surface-dark-accent/60 mb-6">
              60+ node types for any campaign
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {NODE_TYPES.map(nt => (
                <div key={nt.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.07] border border-white/10">
                  <nt.icon size={18} weight="duotone" className="text-surface-dark-accent" />
                  <span className="text-sm text-white/80 font-medium">{nt.label}</span>
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
                <div className="text-3xl md:text-4xl font-bold text-teal">60+</div>
                <div className="mt-1 text-sm text-muted">Node types</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <ChartBar size={40} weight="fill" />
                </div>
                <div className="mt-1 text-sm text-muted">Built-in forecast</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <CopySimple size={40} weight="fill" />
                </div>
                <div className="mt-1 text-sm text-muted">What-if scenarios</div>
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
              Why do you need Funnel Planner?
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              The funnel lives in a PowerPoint nobody updates. Funnel Planner makes it a living,
              shareable board with the forecast built in.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal>
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">Strategy lost in slide decks.</h3>
                <ul className="mt-6 space-y-3">
                  {BEFORE.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink/70">
                      <X size={14} weight="bold" className="text-red-400 shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="rounded-2xl border border-teal/20 bg-teal/[0.03] p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">With Funnel Planner</span>
                <h3 className="mt-3 text-xl font-bold text-ink">A living funnel with the numbers built in.</h3>
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
              Build it. Forecast it. Share it.
            </h2>
          </ScrollReveal>
          <WorkflowTabs />
        </div>
      </section>

      {/* ── Forecast engine ──────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Forecast engine</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                See the numbers before you spend a dollar.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                Input traffic, conversion rates, and offer values per step. The forecast engine
                calculates projected revenue, cost, profit, and ROAS across the entire funnel.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <ChartBar size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Revenue, cost, profit, and ROAS always visible on the board
                </li>
                <li className="flex items-start gap-2.5">
                  <Eye size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Numbers Layer toggles on and off for clean presentations
                </li>
                <li className="flex items-start gap-2.5">
                  <CopySimple size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Duplicate as a what-if scenario and compare strategies
                </li>
                <li className="flex items-start gap-2.5">
                  <Globe size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Six currencies and three period options for localised forecasts
                </li>
              </ul>
            </ScrollReveal>
            <ScrollReveal className="flex-1 w-full" delay={120}>
              <ForecastMockup />
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
              Everything you need to plan and present.
            </h2>
          </ScrollReveal>
          <ScrollReveal>
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
              Plan the campaign. Present the strategy.
            </h2>
          </ScrollReveal>
          <ScrollReveal>
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

      {/* ── Testimonial ──────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <div className="bg-surface-dark rounded-2xl p-8 md:p-10 text-center">
              <p className="text-base md:text-lg text-white/90 leading-relaxed italic">
                &ldquo;Clients actually understand the strategy now because they can see the whole funnel and the numbers in one view. No more static slide decks nobody looks at twice.&rdquo;
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-dark-accent/20 flex items-center justify-center text-sm font-bold text-surface-dark-accent">SD</div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Founding Agency</p>
                  <p className="text-xs text-surface-dark-accent/60">Strategy Director</p>
                </div>
              </div>
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
              Questions about Funnel Planner?
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
              The funnel shouldn&apos;t live in<br className="hidden md:block" /> a dead PowerPoint.
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              Map the strategy, forecast the numbers, and share the whole picture with one link.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              <Link href={CTA_HREF} className="press-scale inline-flex items-center gap-2 h-12 px-7 rounded-lg bg-white text-teal font-semibold hover:bg-white/90 transition-colors">
                {CTA_LABEL} <ArrowRight size={16} weight="bold" />
              </Link>
              <Link href="/pricing" className="text-sm text-white/50 hover:text-white transition-colors">
                View pricing
              </Link>
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

  return (
    <ScrollReveal>
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-8">
        {WORKFLOW_TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`px-5 md:px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active === i ? 'bg-teal text-white shadow-sm' : 'bg-white text-muted hover:text-ink border border-edge'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-white border border-edge p-6 md:p-10 shadow-card-soft">
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

/* ── Forecast Mockup ─────────────────────────────────────── */

function ForecastMockup() {
  const metrics = [
    { label: 'Revenue', value: '$24,800', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Cost', value: '$6,200', color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Profit', value: '$18,600', color: 'text-teal', bg: 'bg-teal/[0.06]' },
    { label: 'ROAS', value: '4.0x', color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="rounded-2xl border border-edge bg-white shadow-card-soft overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/60 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Board Summary</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal/8 text-[9px] font-medium text-teal">
          <Eye size={10} weight="bold" /> Numbers Layer ON
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        {metrics.map(m => (
          <div key={m.label} className={`rounded-xl ${m.bg} p-4`}>
            <div className="text-[10px] font-medium text-muted uppercase tracking-wider">{m.label}</div>
            <div className={`text-xl md:text-2xl font-bold ${m.color} mt-1`}>{m.value}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <div className="rounded-xl border border-edge/60 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CopySimple size={14} className="text-muted" />
            <span className="text-[10px] font-medium text-ink">Scenario A</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted">vs</span>
            <span className="text-[10px] font-medium text-ink/50">Scenario B</span>
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
    <div className="absolute inset-0 pointer-events-none text-teal">
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

/* ── Mock Funnel Canvas ──────────────────────────────────── */

/** Disc node — coloured circle with a white SVG icon inside, matching real
 *  FunnelStepNode rendering (88px disc, Lucide icon, label below). */
function Disc({ tint, icon, label }: { tint: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5">
      <div
        className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-[0_3px_8px_rgba(20,20,40,0.18)]"
        style={{ backgroundColor: tint }}
      >
        {icon}
      </div>
      <span className="text-[7px] md:text-[9px] font-medium text-ink/70 whitespace-nowrap">{label}</span>
    </div>
  );
}

/** Page node — mini browser frame mockup matching real PageMockup component. */
function PageNode({ tint, label }: { tint: string; label: string }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5">
      <div className="w-14 md:w-[72px] h-[52px] md:h-[64px] rounded-md bg-white border border-edge shadow-[0_3px_8px_rgba(20,20,40,0.18)] overflow-hidden flex flex-col">
        <div className="h-2 bg-surface border-b border-edge/60 flex items-center px-1 gap-[2px]">
          <div className="w-[3px] h-[3px] rounded-full bg-[#FF605C]" />
          <div className="w-[3px] h-[3px] rounded-full bg-[#FFBD44]" />
          <div className="w-[3px] h-[3px] rounded-full bg-[#00CA4E]" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-[2px] px-1.5" style={{ backgroundColor: `${tint}10` }}>
          <div className="h-[3px] w-8 rounded-full" style={{ backgroundColor: tint }} />
          <div className="h-[2px] w-6 rounded-full bg-ink/15" />
          <div className="h-[2px] w-7 rounded-full bg-ink/10" />
          <div className="h-[5px] w-8 rounded-sm mt-0.5" style={{ backgroundColor: tint }} />
        </div>
      </div>
      <span className="text-[7px] md:text-[9px] font-medium text-ink/70 whitespace-nowrap">{label}</span>
    </div>
  );
}

/** Arrow connector between nodes. */
function Arrow() {
  return (
    <div className="flex-1 flex items-center min-w-[12px] mx-1 md:mx-2">
      <div className="flex-1 h-px bg-ink/20" />
      <svg width="6" height="8" viewBox="0 0 6 8" className="shrink-0 text-ink/20">
        <path d="M0,0 L6,4 L0,8" fill="currentColor" />
      </svg>
    </div>
  );
}

function MockFunnelUI() {
  return (
    <div className="flex flex-col h-full bg-white text-ink">
      <div className="flex items-center justify-between px-4 md:px-5 py-2.5 shrink-0">
        <span className="text-xs md:text-sm font-semibold">Spring Campaign Funnel</span>
        <div className="flex gap-1.5">
          <div className="px-2 py-1 rounded-md border border-edge text-[9px] text-muted">Share</div>
          <div className="px-2 py-1 rounded-md border border-edge text-[9px] text-muted">Export</div>
        </div>
      </div>
      <div
        className="flex-1 relative"
        style={{
          backgroundColor: '#FAFAFA',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* Funnel flow — real node designs */}
        <div className="absolute inset-0 flex items-center px-4 md:px-8">
          <div className="flex items-center w-full">
            {/* Facebook Ads — disc node, brand blue */}
            <Disc tint="#1877F2" label="Facebook Ads" icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
                <path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
              </svg>
            } />
            <Arrow />
            {/* Landing Page — page node */}
            <PageNode tint="#0EA5E9" label="Landing Page" />
            <Arrow />
            {/* Opt-In — page node */}
            <PageNode tint="#0EA5E9" label="Opt-In" />
            <Arrow />
            {/* Thank You — disc node, pink */}
            <Disc tint="#EC4899" label="Thank You" icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            } />
            <Arrow />
            {/* Email sequence — disc node, blue */}
            <Disc tint="#3B82F6" label="Email" icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
                <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            } />
          </div>
        </div>

        {/* Sticky note */}
        <div className="absolute top-3 right-3 md:top-4 md:right-4 w-16 md:w-20 p-1.5 md:p-2 rounded-sm bg-[#FEF9C3] shadow-sm border border-yellow-200/60 rotate-1">
          <div className="text-[6px] md:text-[7px] text-ink/60 leading-tight">Split test two headlines</div>
        </div>

        {/* Forecast summary badges */}
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {[
            { l: 'Revenue', v: '$24.8k', c: 'text-emerald-600 bg-emerald-50' },
            { l: 'ROAS', v: '4.0x', c: 'text-violet-600 bg-violet-50' },
          ].map(m => (
            <div key={m.l} className={`px-2 py-1 rounded-lg text-[7px] font-semibold ${m.c}`}>
              {m.l}: {m.v}
            </div>
          ))}
        </div>

        {/* People metric pill on first node */}
        <div className="absolute bottom-[30%] left-4 md:left-8 px-1.5 py-0.5 rounded bg-white border border-edge/70 shadow-sm text-[6px] text-muted whitespace-nowrap">
          People <span className="font-semibold text-ink">5,000</span>
        </div>
      </div>
    </div>
  );
}

/* ── Tab Mockups ─────────────────────────────────────────── */

function TabMockup({ variant }: { variant: 'build' | 'forecast' | 'share' }) {
  if (variant === 'build') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="flex items-center gap-2 w-full max-w-[85%]">
        {[
          { tint: '#1877F2', label: 'Ad' },
          { tint: '#0EA5E9', label: 'Page' },
          { tint: '#14B8A6', label: 'Form' },
        ].map((n, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: n.tint }}>
                <div className="w-4 h-4 rounded-sm bg-white/30" />
              </div>
              <span className="text-[6px] text-muted">{n.label}</span>
            </div>
            {i < 2 && <div className="flex-1 h-px bg-ink/10 mx-1.5" />}
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === 'forecast') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[80%] shadow-card">
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: 'Revenue', v: '$24.8k', c: 'bg-emerald-50 text-emerald-600' },
            { l: 'Cost', v: '$6.2k', c: 'bg-red-50 text-red-500' },
            { l: 'Profit', v: '$18.6k', c: 'bg-teal/[0.06] text-teal' },
            { l: 'ROAS', v: '4.0x', c: 'bg-violet-50 text-violet-600' },
          ].map(m => (
            <div key={m.l} className={`rounded-lg ${m.c} px-2.5 py-2`}>
              <div className="text-[7px] font-medium opacity-70 uppercase">{m.l}</div>
              <div className="text-sm font-bold mt-0.5">{m.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[65%] text-center space-y-2 shadow-card">
        <ShareNetwork size={16} weight="duotone" className="text-teal mx-auto" />
        <div className="h-2 w-24 bg-ink/10 rounded mx-auto" />
        <div className="h-7 w-full rounded-lg bg-surface border border-edge flex items-center px-2">
          <span className="text-[7px] text-faint truncate">https://app.agencyviz.io/funnel/abc123</span>
        </div>
        <div className="h-7 w-20 rounded-lg bg-teal mx-auto" />
      </div>
    </div>
  );
}
