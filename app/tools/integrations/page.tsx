'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, X,
  Plug, ChartBar, ArrowsClockwise, Database,
  Shield, Lightning, Globe, Key,
  LinkSimple, Gear, Lock,
  Image, TreeStructure, Eye,
} from '@phosphor-icons/react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { FAQAccordion } from '@/components/marketing/FAQAccordion';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';
const CTA_HREF = PUBLIC_SIGNUP_ON ? '/signup' : '/pricing';
const CTA_LABEL = PUBLIC_SIGNUP_ON ? 'Start free trial' : 'See pricing';

/* ── Data ──────────────────────────────────────────────────── */

const CONNECTORS = [
  { icon: Globe, label: 'Meta Ads' },
  { icon: Lightning, label: 'GoHighLevel' },
  { icon: Plug, label: 'Webhooks' },
  { icon: Key, label: 'OAuth2' },
];

const BEFORE = [
  'Monday mornings spent exporting CSVs from Meta',
  'Reports go stale because nobody updates the data source',
  'Copy-paste errors in spreadsheets nobody catches',
  'Each client report is a manual rebuild',
];

const AFTER = [
  '95+ fields from Meta pull into Looker Studio live',
  'Every refresh hits Meta directly — always current data',
  'Ad creative, thumbnails, and copy right inside reports',
  'Connect once, report on every client automatically',
];

const WORKFLOW_TABS = [
  {
    key: 'connect' as const,
    label: 'Connect',
    title: 'OAuth in one click.',
    desc: 'Connect your Meta account with a secure OAuth flow. No API keys to paste, no tokens to manage. Supports multiple Meta accounts per company.',
  },
  {
    key: 'select' as const,
    label: 'Select',
    title: 'Choose which accounts pipe data.',
    desc: 'Select the ad accounts you want to report on. Each pipes data into the same Looker Studio connector. Add or remove accounts at any time.',
  },
  {
    key: 'report' as const,
    label: 'Report',
    title: 'Live data in Looker Studio.',
    desc: 'Add the AgencyViz connector in Looker Studio. Your report pulls 95+ fields live — spend, clicks, CTR, ROAS, creative thumbnails, and breakdowns by age, gender, country, device, and placement.',
  },
];

const FEATURES = [
  { icon: ChartBar, title: '95+ insight fields', desc: 'Spend, clicks, impressions, CTR, CPC, CPM, ROAS, video metrics, quality ranking, and more.' },
  { icon: Image, title: 'Creative fields', desc: 'Ad thumbnails, copy, CTAs, and destination URLs right inside Looker Studio.' },
  { icon: TreeStructure, title: 'Breakdowns', desc: 'Age, gender, country, region, DMA, device, platform, placement, and hourly.' },
  { icon: Database, title: 'Passthrough architecture', desc: 'No data stored. Every request hits Meta live. Your data never sits in a third party.' },
  { icon: LinkSimple, title: 'Multiple accounts', desc: 'Connect as many Meta accounts as your plan allows. Each pipes into the same connector.' },
  { icon: Gear, title: 'Date rollups', desc: 'Month, quarter, year, week, and day of week derived automatically from daily data.' },
];

const USE_CASES = [
  { title: 'Client Reporting', desc: 'Build a Looker Studio report once. It pulls live data from Meta every time the client opens it. No CSV, no manual refresh.' },
  { title: 'Campaign Monitoring', desc: 'Check performance without logging into Meta. Your Looker Studio dashboard always has the latest numbers across every account.' },
  { title: 'Multi-Client Agencies', desc: 'Connect multiple Meta ad accounts. Each client\'s data pipes into one connector. Build once, report on everyone.' },
];

const FAQS = [
  { q: 'How does the connector work?', a: 'AgencyViz provides a Google Apps Script community connector. Add it in Looker Studio, authenticate via OAuth, and it pulls live data from your connected Meta accounts.' },
  { q: 'Does AgencyViz store my ad data?', a: 'No. AgencyViz is the pipe. Every Looker Studio refresh request hits Meta live. No ad data is stored in AgencyViz.' },
  { q: 'How many fields are available?', a: '95+ fields: spend, clicks, impressions, CTR, CPC, CPM, ROAS, video metrics, quality rankings, creative thumbnails, ad copy, CTAs, destination URLs, and breakdowns by age, gender, country, device, placement, and more.' },
  { q: 'How often does data refresh?', a: 'Looker Studio caches data for approximately 12 hours. Each refresh pulls the latest numbers directly from Meta.' },
  { q: 'Is my Meta token secure?', a: 'Yes. Access tokens are encrypted with AES-256-GCM and auto-refreshed via cron. The encryption key is never exposed to client-side code.' },
  { q: 'Can I connect multiple Meta accounts?', a: 'Yes. Connect as many Meta accounts as your plan allows. Each account\'s data pipes into the same Looker Studio connector.' },
  { q: 'What about GoHighLevel?', a: 'GoHighLevel provides two-way CRM sync — proposal and quote stage changes push to GHL as contact upserts and opportunity stage moves. Quote totals sync as opportunity values.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function IntegrationsPage() {
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
                <Plug size={14} weight="bold" /> Looker Studio Connector
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Your report. Your data.<br />
                <span className="text-white/80">No manual export.</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
                Connect Meta to Looker Studio and pull 95+ fields — spend, clicks, ROAS,
                creative thumbnails, and breakdowns — live, with zero CSV exports.
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
                <MockIntegrationsUI />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Connector bar ────────────────────────────────── */}
      <section className="bg-surface-dark py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-wider text-surface-dark-accent/60 mb-6">
              Pipe your data into Looker Studio
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {CONNECTORS.map(c => (
                <div key={c.label} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.07] border border-white/10">
                  <c.icon size={20} weight="duotone" className="text-surface-dark-accent" />
                  <span className="text-sm text-white/80 font-medium">{c.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Before / After ───────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Why do you need Integrations?
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              Every Monday morning: log into Meta, export CSV, paste into the spreadsheet,
              fix the formatting. Integrations replaces the routine with a live connection.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal variant="slide-left">
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">Manual CSV exports every week.</h3>
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
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">With Integrations</span>
                <h3 className="mt-3 text-xl font-bold text-ink">Live data, zero exports.</h3>
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
              Connect. Select. Report.
            </h2>
          </ScrollReveal>
          <WorkflowTabs />
        </div>
      </section>

      {/* ── Passthrough trust ────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal variant="slide-left" className="flex-1 max-w-lg">
              <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Your data never sits in a third-party database.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                AgencyViz is the pipe, not the warehouse. Every Looker Studio refresh request
                goes straight to Meta. No ad data is stored, cached, or retained.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <Database size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Pure passthrough — every request hits Meta live
                </li>
                <li className="flex items-start gap-2.5">
                  <Shield size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  AES-256-GCM encrypted token storage
                </li>
                <li className="flex items-start gap-2.5">
                  <ArrowsClockwise size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Auto-refresh tokens via cron — no manual management
                </li>
                <li className="flex items-start gap-2.5">
                  <Lock size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Company-scoped connections with row-level security
                </li>
              </ul>
            </ScrollReveal>
            <ScrollReveal variant="slide-right" className="flex-1 w-full" delay={120}>
              <PassthroughDiagram />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              What you get in every report
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
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Reports that update themselves
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="scale">
            <div className="grid md:grid-cols-3 gap-5">
              {USE_CASES.map(uc => (
                <div key={uc.title} className="rounded-2xl border border-edge bg-white p-6 hover-lift">
                  <h3 className="text-base font-semibold text-ink">{uc.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Trust signals ────────────────────────────────── */}
      <section className="py-14 md:py-18">
        <div className="max-w-3xl mx-auto px-6">
          <ScrollReveal>
            <div className="grid grid-cols-3 gap-6 md:gap-10">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-teal/8 flex items-center justify-center mb-3">
                  <Shield size={20} weight="duotone" className="text-teal" />
                </div>
                <p className="text-sm font-semibold text-ink">AES-256-GCM</p>
                <p className="text-xs text-muted mt-0.5">Encrypted token storage</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-teal/8 flex items-center justify-center mb-3">
                  <Database size={20} weight="duotone" className="text-teal" />
                </div>
                <p className="text-sm font-semibold text-ink">Zero retention</p>
                <p className="text-xs text-muted mt-0.5">No ad data stored</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-teal/8 flex items-center justify-center mb-3">
                  <ArrowsClockwise size={20} weight="duotone" className="text-teal" />
                </div>
                <p className="text-sm font-semibold text-ink">Live data</p>
                <p className="text-xs text-muted mt-0.5">Every refresh hits Meta</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-2xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Questions about the connector
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
              Monday morning CSV exports<br className="hidden md:block" /> are over.
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              Connect once. Your reports pull live data from Meta every time the client opens them.
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

/* ── Passthrough Diagram ─────────────────────────────────── */

function PassthroughDiagram() {
  const steps = [
    { label: 'Looker Studio', sub: 'Refresh request', icon: ChartBar, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
    { label: 'AgencyViz', sub: 'Pass through (0 data stored)', icon: Plug, bg: 'bg-teal/[0.06]', border: 'border-teal/20', color: 'text-teal' },
    { label: 'Meta Ads API', sub: 'Live response', icon: Globe, bg: 'bg-violet-50', border: 'border-violet-200', color: 'text-violet-600' },
  ];

  return (
    <div className="rounded-2xl border border-edge bg-white p-6 md:p-8 shadow-card-soft">
      <div className="text-xs font-semibold text-ink mb-5 text-center">Data flow — every refresh</div>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={s.label}>
            <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${s.bg} ${s.border}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                <s.icon size={18} weight="duotone" className={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${s.color}`}>{s.label}</div>
                <div className="text-[10px] text-muted">{s.sub}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <svg width="12" height="16" viewBox="0 0 12 16" className="text-ink/20">
                  <path d="M6,0 L6,10 M2,7 L6,12 L10,7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-edge/50 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[10px] font-semibold text-emerald-600 border border-emerald-100">
          <Shield size={12} weight="fill" /> Zero data retention
        </div>
      </div>
    </div>
  );
}

/* ── Floating Paths ──────────────────────────────────────── */

function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.7 + i * 0.05,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none text-white" style={{ contain: 'strict' }}>
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

/* ── Mock Integrations UI ────────────────────────────────── */

function MockIntegrationsUI() {
  const fields = ['Campaign Name', 'Impressions', 'Clicks', 'CTR', 'Spend', 'CPC', 'Conversions', 'ROAS'];
  return (
    <div className="flex flex-col h-full bg-white text-ink" aria-hidden="true" role="img" aria-label="Preview of the Looker Studio connector interface">
      <div className="flex items-center justify-between px-4 md:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Plug size={14} weight="duotone" className="text-teal" />
          <span className="text-xs md:text-sm font-semibold">Looker Studio Connector</span>
        </div>
        <div className="px-2.5 py-1 rounded-md border border-edge text-[9px] text-muted flex items-center gap-1">
          <Gear size={10} /> Settings
        </div>
      </div>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 p-4 md:p-6 space-y-4">
          {[
            { name: 'Meta Ads', status: 'Connected', accounts: 3, dot: 'bg-emerald-400' },
            { name: 'GoHighLevel', status: 'Available', accounts: 0, dot: 'bg-muted' },
          ].map(c => (
            <div key={c.name} className="rounded-xl border border-edge p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-lg">
                {c.name === 'Meta Ads' ? '📊' : '⚡'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm font-semibold">{c.name}</div>
                <div className="text-[9px] text-muted">{c.accounts > 0 ? `${c.accounts} accounts connected` : 'Not connected'}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-[9px] font-medium text-ink/70">{c.status}</span>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-edge p-4">
            <div className="text-[10px] font-semibold mb-3">Available fields (95+)</div>
            <div className="flex flex-wrap gap-1.5">
              {fields.map(f => (
                <span key={f} className="px-2 py-1 rounded bg-surface text-[8px] font-medium text-ink/70 border border-edge/50">{f}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-col w-[200px] border-l border-edge p-4 bg-paper shrink-0">
          <div className="text-[10px] font-semibold mb-3">How it works</div>
          <div className="space-y-3 text-[9px] text-muted leading-relaxed">
            {['Connect your Meta account via OAuth', 'Select ad accounts to pipe data from', 'Add the connector in Looker Studio', 'Your report pulls live numbers'].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-teal text-white text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tab Mockups ─────────────────────────────────────────── */

function TabMockup({ variant }: { variant: 'connect' | 'select' | 'report' }) {
  if (variant === 'connect') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-5 max-w-[70%] text-center space-y-3 shadow-card">
        <div className="w-10 h-10 rounded-xl bg-blue-50 mx-auto flex items-center justify-center text-lg">📊</div>
        <div className="h-2.5 w-28 bg-ink/10 rounded mx-auto" />
        <div className="h-1.5 w-40 bg-ink/5 rounded mx-auto" />
        <div className="h-8 w-32 rounded-lg bg-[#1877F2] mx-auto flex items-center justify-center">
          <span className="text-white text-[8px] font-medium">Connect with Meta</span>
        </div>
      </div>
    </div>
  );

  if (variant === 'select') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[75%] space-y-2 shadow-card">
        <div className="text-[9px] font-semibold">Select ad accounts</div>
        {['Brand Account', 'Client: Coastal Realty', 'Client: Metro Dental'].map((a, i) => (
          <div key={a} className="flex items-center gap-2 px-2 py-1.5 rounded border border-edge text-[8px]">
            <div className={`w-3.5 h-3.5 rounded border-2 ${i < 2 ? 'bg-teal border-teal' : 'border-edge'} flex items-center justify-center`}>
              {i < 2 && <span className="text-white text-[6px]">✓</span>}
            </div>
            <span className="text-ink/80">{a}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="w-[85%] aspect-[16/10] rounded-lg bg-white border border-edge shadow-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ChartBar size={10} weight="duotone" className="text-teal" />
          <span className="text-[8px] font-semibold">Looker Studio Report</span>
        </div>
        <div className="flex gap-2 h-[60%]">
          {[20, 30, 15, 25].map((h, i) => (
            <div key={i} className="flex-1 rounded bg-gradient-to-t from-teal/20 to-transparent" style={{ opacity: 0.5 + h / 50 }} />
          ))}
        </div>
        <div className="flex gap-3">
          {['Impressions', 'Clicks', 'ROAS'].map(l => (
            <div key={l} className="text-[7px] text-muted">{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
