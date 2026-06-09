'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, X,
  Image, VideoCamera, FileText, Envelope, ChatDots, Globe,
  Megaphone, MagnifyingGlass,
  PushPin, PencilLine, Stack, Users, Clock,
  GitBranch, Highlighter, LinkSimple, BellRinging,
  Eye, EyeSlash, CheckCircle,
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

const CONTENT_TYPES = [
  { icon: Image, label: 'Images' },
  { icon: VideoCamera, label: 'Video' },
  { icon: FileText, label: 'PDFs' },
  { icon: Envelope, label: 'Email' },
  { icon: ChatDots, label: 'SMS' },
  { icon: Globe, label: 'Webpages' },
  { icon: Megaphone, label: 'Meta Ads' },
  { icon: MagnifyingGlass, label: 'Google Ads' },
];

const BEFORE = [
  '"Can you change the thing on the third one" — actual client feedback',
  'Feedback screenshots buried in Slack and email threads',
  'Nobody knows which version was approved',
  'Internal drafts accidentally shared with clients',
];

const AFTER = [
  'Feedback pinned on the exact pixel it refers to',
  'Every revision tracked through stages to done',
  'Internal stages invisible to clients',
  'Every reviewer signs off individually',
];

const WORKFLOW_TABS = [
  {
    key: 'pin' as const,
    label: 'Pin',
    title: 'Pin feedback on the creative.',
    desc: 'Click anywhere on an image, video, PDF, or webpage to drop a numbered comment. Draw arrows and boxes. Highlight text in emails. Every piece of feedback is visually anchored — no more "the headline on the third one."',
  },
  {
    key: 'kanban' as const,
    label: 'Track',
    title: 'Kanban from draft to done.',
    desc: 'Items move through Draft → Internal Review → Client Review → Approved. Stage-based visibility keeps internal work internal. Assign reviewers per stage — the right eyes at the right time.',
  },
  {
    key: 'approve' as const,
    label: 'Approve',
    title: 'Per-reviewer sign-off.',
    desc: 'Every reviewer approves individually. When all assigned reviewers sign off, the item auto-advances to the next stage. Upload new versions without losing the conversation. Full history on every round.',
  },
];

const STAGES = [
  { name: 'Draft', internal: true, dot: 'bg-muted' },
  { name: 'Internal Review', internal: true, dot: 'bg-amber-400' },
  { name: 'Client Review', internal: false, dot: 'bg-blue-400' },
  { name: 'Approved', internal: false, dot: 'bg-emerald-400' },
];

const FEATURES = [
  { icon: PushPin, title: 'Pin comments', desc: 'Click anywhere on the creative to leave a numbered comment.' },
  { icon: PencilLine, title: 'Drawing annotations', desc: 'Draw arrows, boxes, and text directly on the creative.' },
  { icon: Stack, title: 'Stage-based workflow', desc: 'Eight stages from Draft to Archived. Assign reviewers per stage.' },
  { icon: Users, title: 'Per-reviewer approvals', desc: 'Every reviewer signs off individually. Auto-advance when all approve.' },
  { icon: Clock, title: 'Version history', desc: 'Upload new versions. Every version keeps its own comments and history.' },
  { icon: GitBranch, title: 'Whiteboard view', desc: 'Map your campaign on an infinite canvas with shapes and sticky notes.' },
  { icon: Highlighter, title: 'Text highlighting', desc: 'Highlight text and comment inline on emails and SMS copy.' },
  { icon: LinkSimple, title: 'Guest access', desc: 'Share a link. Clients review and approve without creating an account.' },
  { icon: BellRinging, title: 'Stage-scoped notifications', desc: 'Reviewers get notified about their stages only. No noise.' },
];

const USE_CASES = [
  { title: 'Campaign Creative Review', desc: 'Upload ads, banners, social posts, and video. Clients and internal reviewers pin feedback on the actual creative. Every revision tracked through stages.', gradient: 'from-violet-100 to-pink-50' },
  { title: 'Website & Landing Page QA', desc: 'Enter a URL and review it live in the browser. Pin comments on any element. Internal team reviews first — clients see only what\'s ready.', gradient: 'from-sky-100 to-cyan-50' },
  { title: 'Email & SMS Approval', desc: 'Paste email HTML or SMS copy. Reviewers highlight specific text and leave inline comments. Each ad variant gets its own pin layer.', gradient: 'from-amber-100 to-yellow-50' },
];

const FAQS = [
  { q: 'What content types can clients review?', a: 'Images, video, PDFs, webpages, emails, SMS, Google Ads, and Meta Ads — each with a dedicated preview and feedback tools.' },
  { q: 'Can clients only see certain stages?', a: 'Yes. Clients only see items in Client Review, Approved, or Rejected. Draft, In Progress, and Internal Review stages are invisible to guests.' },
  { q: 'How does the approval flow work?', a: 'Assign reviewers per stage. Each reviewer approves individually. When all assigned reviewers sign off, the item auto-advances to the next stage. You can also move items manually.' },
  { q: 'Do clients need an account?', a: 'No. Clients open a review link, enter their name and email, and start pinning feedback. No signup, no app, no friction.' },
  { q: 'Can I track who approved what?', a: 'Yes. Every approval is recorded per reviewer, per version, per stage. Full audit trail on every round.' },
  { q: 'How is this different from email threads?', a: 'Feedback sits on the creative itself — not in a chain of forwards. Stage-based workflows replace status-check messages. Version history replaces "which one are we talking about?" Every piece of feedback is traceable and actionable.' },
  { q: 'Can I run internal review before showing clients?', a: 'Yes. That\'s the default workflow. Items start in Draft, move through Internal Review, and only become visible to clients when you move them to Client Review.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function MarkupPage() {
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
                <ChatDots size={14} weight="bold" /> Markup
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Feedback that lands<br />
                <span className="text-white/80">where it belongs.</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
                Pin comments on images, video, emails, webpages, and ads.
                Track every revision through a stage-based workflow.
                Get sign-off without a single email thread.
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
                <MockMarkupUI />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 2. Content types ─────────────────────────────── */}
      <section className="bg-surface-dark py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-wider text-surface-dark-accent/60 mb-6">
              Review anything your agency produces
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {CONTENT_TYPES.map(ct => (
                <div key={ct.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.07] border border-white/10">
                  <ct.icon size={18} weight="duotone" className="text-surface-dark-accent" />
                  <span className="text-sm text-white/80 font-medium">{ct.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────── */}
      <section className="py-12 md:py-14 border-b border-edge/50">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal">10+</div>
                <div className="mt-1 text-sm text-muted">Content types</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal">8</div>
                <div className="mt-1 text-sm text-muted">Workflow stages</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <CheckCircle size={40} weight="fill" />
                </div>
                <div className="mt-1 text-sm text-muted">Per-reviewer sign-off</div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 3. Before / After ────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Why do you need Markup?
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              The best creative work happens when feedback is clear, traceable, and impossible to lose.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal>
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">The email thread nobody can follow.</h3>
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
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">With Markup</span>
                <h3 className="mt-3 text-xl font-bold text-ink">Pinned, assigned, tracked, signed off.</h3>
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

      {/* ── 4. How it works (tabs) ───────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">How it works</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Pin it. Track it. Sign it off.
            </h2>
          </ScrollReveal>
          <WorkflowTabs />
        </div>
      </section>

      {/* ── 5. Client experience ─────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Client experience</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Your client sees only what&apos;s ready.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                Internal stages stay invisible. Clients only see items that have been moved
                to client-facing stages. No account needed — they open a link and start reviewing.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <Eye size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Share a project or individual asset with one link
                </li>
                <li className="flex items-start gap-2.5">
                  <EyeSlash size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Draft and Internal Review stages hidden from guests
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Clients pin feedback, approve, and submit without signing up
                </li>
              </ul>
            </ScrollReveal>
            <ScrollReveal className="flex-1 w-full" delay={120}>
              <StageVisibility />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── 6. Features ──────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">Features</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Everything you need for creative review.
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

      {/* ── 7. Use cases ─────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">Use cases</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Built for how agencies actually work.
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

      {/* ── 9. FAQ ───────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-surface/40 border-y border-edge/50">
        <div className="max-w-2xl mx-auto px-6">
          <ScrollReveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">FAQ</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Questions about Markup?
            </h2>
          </ScrollReveal>
          <ScrollReveal>
            <FAQAccordion items={FAQS} />
          </ScrollReveal>
        </div>
      </section>

      {/* ── 10. Final CTA ────────────────────────────────── */}
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
              Stop decoding &ldquo;the headline<br className="hidden md:block" /> on the third one.&rdquo;
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              Pin feedback on the creative. Track every revision. Get sign-off without the email thread.
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

/* ── Stage Visibility ────────────────────────────────────── */

function StageVisibility() {
  return (
    <div className="rounded-2xl border border-edge bg-white p-6 md:p-8 shadow-card-soft">
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs font-semibold text-muted flex items-center gap-1.5">
          <EyeSlash size={14} /> Internal only
        </div>
        <div className="text-xs font-semibold text-teal flex items-center gap-1.5">
          <Eye size={14} /> Client sees this
        </div>
      </div>
      <div className="space-y-2">
        {STAGES.map(s => (
          <div
            key={s.name}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
              s.internal
                ? 'border-edge/60 bg-surface/40'
                : 'border-teal/20 bg-teal/[0.04]'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className={`text-sm font-medium flex-1 ${s.internal ? 'text-muted' : 'text-ink'}`}>
              {s.name}
            </span>
            {s.internal ? (
              <EyeSlash size={16} className="text-muted/40" />
            ) : (
              <Eye size={16} className="text-teal" />
            )}
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted text-center">
        Guests never see Draft or Internal Review stages.
      </p>
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

/* ── Mock Markup Kanban ──────────────────────────────────── */

function MockMarkupUI() {
  const tabs = ['Kanban', 'Board', 'Assets', 'Comments'];
  const cols = [
    { label: 'Draft', dot: 'bg-muted', items: ['Email Header'] },
    { label: 'Internal Review', dot: 'bg-amber-400', items: ['Facebook Ad v2', 'IG Story'] },
    { label: 'Client Review', dot: 'bg-blue-400', items: ['Hero Banner', 'Landing Page'] },
    { label: 'Approved', dot: 'bg-emerald-400', items: ['Logo v3', 'Email v2'] },
  ];
  const thumbs = [
    'from-blue-100 to-blue-50', 'from-violet-100 to-pink-50', 'from-rose-100 to-orange-50',
    'from-sky-100 to-cyan-50', 'from-indigo-100 to-blue-50', 'from-teal-100 to-emerald-50',
    'from-amber-100 to-yellow-50',
  ];
  let ti = 0;

  return (
    <div className="flex flex-col h-full bg-white text-ink">
      <div className="flex items-center justify-between px-4 md:px-5 py-2.5 shrink-0">
        <span className="text-xs md:text-sm font-semibold">Brand Campaign Q4</span>
        <div className="px-2.5 py-1 rounded-md bg-teal text-white text-[9px] font-medium">+ Add Asset</div>
      </div>
      <div className="flex items-center gap-0.5 px-4 md:px-5 border-b border-edge shrink-0">
        {tabs.map((t, i) => (
          <div key={t} className={`px-2.5 md:px-3 py-2 text-[9px] md:text-[10px] font-medium border-b-2 ${
            i === 0 ? 'border-teal text-teal' : 'border-transparent text-faint'
          }`}>{t}</div>
        ))}
      </div>
      <div className="flex-1 flex gap-3 p-3 md:p-4 overflow-hidden">
        {cols.map(col => (
          <div key={col.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className="text-[8px] md:text-[9px] font-semibold">{col.label}</span>
            </div>
            <div className="space-y-2">
              {col.items.map(item => {
                const thumb = thumbs[ti++ % thumbs.length];
                return (
                  <div key={item} className="rounded-xl bg-white border border-edge/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className={`h-10 md:h-14 bg-gradient-to-br ${thumb}`} />
                    <div className="px-2 py-1.5">
                      <div className="text-[8px] md:text-[9px] font-medium truncate">{item}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab Mockups ─────────────────────────────────────────── */

function TabMockup({ variant }: { variant: 'pin' | 'kanban' | 'approve' }) {
  if (variant === 'pin') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="relative w-[80%] aspect-[4/3] rounded-lg bg-gradient-to-br from-sky-200 to-cyan-100 shadow-sm">
        <div className="absolute top-[20%] left-[30%] w-5 h-5 rounded-full bg-teal text-white text-[8px] font-bold flex items-center justify-center border-2 border-white shadow">1</div>
        <div className="absolute top-[50%] left-[60%] w-5 h-5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center border-2 border-white shadow">2</div>
        <div className="absolute top-[15%] right-[12%] bg-surface-dark text-white px-2.5 py-1.5 rounded-lg text-[7px] shadow-lg max-w-[45%]">
          Headline too small — increase to 48px
          <div className="absolute bottom-0 left-3 w-1.5 h-1.5 bg-surface-dark rotate-45 translate-y-0.5" />
        </div>
      </div>
    </div>
  );

  if (variant === 'kanban') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="flex gap-2 w-full max-w-[90%]">
        {[
          { l: 'Draft', d: 'bg-muted', n: 1 },
          { l: 'Review', d: 'bg-amber-400', n: 2 },
          { l: 'Approved', d: 'bg-emerald-400', n: 1 },
        ].map(c => (
          <div key={c.l} className="flex-1">
            <div className="flex items-center gap-1 mb-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${c.d}`} />
              <span className="text-[7px] font-semibold">{c.l}</span>
            </div>
            <div className="space-y-1">
              {Array.from({ length: c.n }).map((_, j) => (
                <div key={j} className="rounded bg-white border border-edge/50 p-1.5">
                  <div className="h-6 rounded bg-surface/50 mb-1" />
                  <div className="h-1 w-3/4 bg-ink/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[70%] space-y-3 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-semibold">Hero Banner v3</span>
          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Approved</span>
        </div>
        <div className="h-16 rounded bg-gradient-to-br from-sky-100 to-cyan-50" />
        <div className="flex items-center gap-1 text-[7px] text-muted">
          <CheckCircle size={10} weight="bold" className="text-emerald-400" /> All 3 reviewers approved
        </div>
      </div>
    </div>
  );
}
