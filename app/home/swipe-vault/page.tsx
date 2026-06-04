'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, X,
  BookmarkSimple, MagnifyingGlass, Tag, FolderOpen,
  ShareNetwork, Image, VideoCamera,
  Funnel, LinkSimple, DeviceMobile,
  FileText, CloudArrowUp, Eye,
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

const SAVE_TYPES = [
  { icon: Image, label: 'Images' },
  { icon: VideoCamera, label: 'Video' },
  { icon: DeviceMobile, label: 'Feed Mockups' },
  { icon: FileText, label: 'Ad Copy' },
  { icon: Tag, label: 'Persuasion Tags' },
  { icon: FolderOpen, label: 'Folders' },
];

const PERSUASION_ANGLES = [
  'Clarity & Value', 'Identity & Alignment', 'Enemy / Contrarian',
  'Proof & Transformation', 'Mechanism / Education', 'Pattern Interrupt',
  'Offer & Urgency', 'Emotional Resonance', 'Novelty / Futureproof',
];

const BEFORE = [
  'Inspiration scattered across phones, desktops, and Slack threads',
  'Screenshots with no copy, no CTA, no context about why it worked',
  'When you need a reference, you can never find it',
  'No shared library — every team member starts from scratch',
];

const AFTER = [
  'Save ads with the creative, the copy, and the full metadata',
  'Tag by persuasion angle — clarity, proof, urgency, curiosity',
  'Realistic Facebook feed mockup for every saved ad',
  'One shared vault the whole team draws from',
];

const WORKFLOW_TABS = [
  {
    key: 'save' as const,
    label: 'Save',
    title: 'Save the creative and the context.',
    desc: 'Save images and videos with the full ad copy — headline, primary text, description, CTA, source URL, and notes. The creative and the context stay together.',
  },
  {
    key: 'organise' as const,
    label: 'Organise',
    title: 'Tag by what makes it work.',
    desc: 'Tag every save with one of nine persuasion angles — Clarity & Value, Proof & Transformation, Offer & Urgency, and more. Filter by tag, format, or folder to find the right reference in seconds.',
  },
  {
    key: 'share' as const,
    label: 'Share',
    title: 'Share a curated board.',
    desc: 'Send a link to a curated collection. Clients see the inspiration — with rich link previews and Open Graph cards — and align on creative direction before a single asset is built.',
  },
];

const FEATURES = [
  { icon: BookmarkSimple, title: 'Save with full metadata', desc: 'Headline, primary text, CTA, source URL, and notes alongside the creative.' },
  { icon: DeviceMobile, title: 'Facebook feed mockup', desc: 'Realistic preview of how every saved ad looks in the Facebook feed.' },
  { icon: Tag, title: '9 persuasion angle tags', desc: 'Clarity, proof, urgency, curiosity — categorise ads by what makes them work.' },
  { icon: FolderOpen, title: 'Folders & boards', desc: 'Organise saves by client, campaign, industry, or any scheme.' },
  { icon: Funnel, title: 'Grid view & filters', desc: 'AND-logic filtering across tags, format, and folder. Find anything fast.' },
  { icon: VideoCamera, title: 'Video transcription', desc: 'Save the spoken words alongside the video. Reference what was said.' },
  { icon: CloudArrowUp, title: 'Bulk upload', desc: 'Upload multiple assets at once after a research session.' },
  { icon: LinkSimple, title: 'Shareable links', desc: 'Rich link previews with Open Graph and Twitter cards per save.' },
  { icon: MagnifyingGlass, title: 'Search your vault', desc: 'Find any saved ad by keyword across titles, tags, and notes.' },
];

const USE_CASES = [
  { title: 'Competitor Research', desc: 'Save and study competitor ads. Tag by persuasion angle, identify patterns, and find your next winning concept.', gradient: 'from-rose-100 to-pink-50' },
  { title: 'Client Creative Direction', desc: 'Curate a board of references and share it with the client. Align on direction before a single asset is built.', gradient: 'from-sky-100 to-cyan-50' },
  { title: 'Team Knowledge Base', desc: 'Build a shared library of best performers. New team members ramp up faster with a vault of proven work to study.', gradient: 'from-amber-100 to-yellow-50' },
];

const FAQS = [
  { q: 'What can I save?', a: 'Images and videos, with full ad copy metadata — headline, primary text, description, CTA, source URL, and notes. Videos up to 100MB.' },
  { q: 'What are the persuasion angle tags?', a: 'Nine tags based on advertising persuasion psychology: Clarity & Value, Identity & Alignment, Enemy/Contrarian, Proof & Transformation, Mechanism/Education, Pattern Interrupt & Curiosity, Offer & Urgency, Emotional Resonance, and Novelty/Futureproof.' },
  { q: 'Can I share saves with clients?', a: 'Yes. Create a curated board and share it via link. Each save has rich Open Graph and Twitter card link previews.' },
  { q: 'What does the Facebook feed mockup look like?', a: 'A realistic recreation of how the ad appears in the Facebook news feed — profile photo, page name, ad copy, creative, CTA button, and engagement icons.' },
  { q: 'Can my whole team use the same vault?', a: 'Yes. Everyone on your team saves to the same vault. Build a shared reference library the whole team draws from.' },
  { q: 'Can I save video transcriptions?', a: 'Yes. A dedicated transcription field stores the spoken words alongside the video so you can reference what was said, not just what was shown.' },
  { q: 'How do I organise my saves?', a: 'Custom tags (including the 9 persuasion angles), folders, and boards. Filter by type, format, tag, or any combination with AND logic.' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function SwipeVaultPage() {
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
                <BookmarkSimple size={14} weight="bold" /> Swipe Vault
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink tracking-tight leading-[1.1]">
                Save the winners.<br />
                <span className="text-teal">Study what works.</span>
              </h1>
              <p className="mt-5 text-base md:text-lg text-prose max-w-2xl mx-auto leading-relaxed">
                Save ads with the creative, the copy, and the metadata. Tag by persuasion angle.
                See every save in a realistic Facebook feed mockup. Share curated boards with clients.
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
                <MockSwipeUI />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Save types ───────────────────────────────────── */}
      <section className="bg-surface-dark py-12 md:py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <ScrollReveal>
            <p className="text-sm font-medium uppercase tracking-wider text-surface-dark-accent/60 mb-6">
              More than screenshots — save the full picture
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {SAVE_TYPES.map(t => (
                <div key={t.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.07] border border-white/10">
                  <t.icon size={18} weight="duotone" className="text-surface-dark-accent" />
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
                <div className="text-3xl md:text-4xl font-bold text-teal">9</div>
                <div className="mt-1 text-sm text-muted">Persuasion angles</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <DeviceMobile size={40} weight="fill" />
                </div>
                <div className="mt-1 text-sm text-muted">Feed mockup</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-teal flex justify-center">
                  <VideoCamera size={40} weight="fill" />
                </div>
                <div className="mt-1 text-sm text-muted">Video transcription</div>
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
              Why do you need a Swipe Vault?
            </h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">
              The best agencies study what works. A screenshot in your camera roll doesn&apos;t cut it.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-5">
            <ScrollReveal>
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 h-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-xl font-bold text-ink">Screenshots in a folder somewhere.</h3>
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
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">With Swipe Vault</span>
                <h3 className="mt-3 text-xl font-bold text-ink">The creative, the copy, and the why.</h3>
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
              Save it. Tag it. Share it.
            </h2>
          </ScrollReveal>
          <WorkflowTabs />
        </div>
      </section>

      {/* ── Persuasion angles ────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <ScrollReveal className="flex-1 max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Persuasion angles</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                Tag ads by what makes them work.
              </h2>
              <p className="mt-4 text-prose leading-relaxed">
                Every ad in the vault can be tagged with one of nine persuasion angles.
                When you&apos;re building a brief, filter by angle to find references
                that match the approach — not just the format.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <Tag size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Nine angles based on advertising persuasion psychology
                </li>
                <li className="flex items-start gap-2.5">
                  <Funnel size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  AND-logic filtering — combine tags, formats, and folders
                </li>
                <li className="flex items-start gap-2.5">
                  <Eye size={16} weight="bold" className="text-teal shrink-0 mt-0.5" />
                  Realistic Facebook feed mockup on every saved ad
                </li>
              </ul>
            </ScrollReveal>
            <ScrollReveal className="flex-1 w-full" delay={120}>
              <div className="rounded-2xl border border-edge bg-white p-6 md:p-8 shadow-card-soft">
                <div className="text-xs font-semibold text-ink mb-4 flex items-center gap-1.5">
                  <Tag size={14} className="text-teal" /> 9 Persuasion Angle Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERSUASION_ANGLES.map(a => (
                    <span key={a} className="px-3 py-1.5 rounded-lg bg-teal/8 text-xs font-medium text-teal border border-teal/10">
                      {a}
                    </span>
                  ))}
                </div>
                <div className="mt-5 pt-5 border-t border-edge/50">
                  <div className="text-[10px] font-medium text-muted mb-2">Example: filtering by &ldquo;Proof &amp; Transformation&rdquo;</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { thumb: 'from-emerald-100 to-teal-50', label: 'Before/After' },
                      { thumb: 'from-sky-100 to-blue-50', label: 'Testimonial' },
                      { thumb: 'from-amber-100 to-yellow-50', label: 'Case Study' },
                    ].map(c => (
                      <div key={c.label} className="rounded-lg border border-edge/60 overflow-hidden">
                        <div className={`aspect-[4/3] bg-gradient-to-br ${c.thumb}`} />
                        <div className="px-2 py-1.5 text-[8px] font-medium text-ink/70 truncate">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
              A proper ad reference library.
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
              Study what wins. Build what&apos;s next.
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
                &ldquo;Our whole team saves to the same vault now. When we need inspiration for a brief, it&apos;s all right there — the creative, the copy, and the angle — instead of scattered across 12 Slack threads.&rdquo;
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
              Questions about Swipe Vault?
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
              Your best ad references are<br className="hidden md:block" /> scattered across 12 devices.
            </h2>
            <p className="mt-5 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">
              Put them in one searchable, shareable vault your whole team draws from.
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

/* ── Floating Paths ──────────────────────────────────────── */

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

/* ── Mock Swipe UI ───────────────────────────────────────── */

function MockSwipeUI() {
  const cards = [
    { title: 'Summer Sale – Hero', tag: 'Offer & Urgency', thumb: 'from-rose-200 to-pink-100' },
    { title: 'UGC Testimonial', tag: 'Proof', thumb: 'from-amber-200 to-yellow-100' },
    { title: 'Product Carousel', tag: 'Clarity & Value', thumb: 'from-sky-200 to-cyan-100' },
    { title: 'Before & After', tag: 'Transformation', thumb: 'from-violet-200 to-purple-100' },
    { title: 'Brand Story', tag: 'Identity', thumb: 'from-emerald-200 to-teal-100' },
    { title: 'Flash Promo', tag: 'Urgency', thumb: 'from-orange-200 to-red-100' },
  ];
  return (
    <div className="flex flex-col h-full bg-white text-ink">
      <div className="flex items-center justify-between px-4 md:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <BookmarkSimple size={14} className="text-teal" />
          <span className="text-xs md:text-sm font-semibold">Swipe Vault</span>
        </div>
        <div className="flex gap-1.5">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-edge text-[9px] text-muted">
            <MagnifyingGlass size={10} /> Search
          </div>
          <div className="px-2.5 py-1 rounded-md bg-teal text-white text-[9px] font-medium">+ Save Ad</div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 md:px-5 py-2 border-b border-edge shrink-0">
        {[{ l: 'All types' }, { l: 'Tags' }, { l: 'Folders' }].map(f => (
          <div key={f.l} className="px-2 py-1 rounded-md bg-surface text-[8px] font-medium text-ink/70">{f.l}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 p-3 md:p-4 overflow-hidden content-start">
        {cards.map(c => (
          <div key={c.title} className="rounded-xl border border-edge/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className={`aspect-[4/3] bg-gradient-to-br ${c.thumb}`} />
            <div className="px-2.5 py-2">
              <div className="text-[9px] md:text-[10px] font-medium truncate">{c.title}</div>
              <div className="mt-1 inline-flex px-1.5 py-0.5 rounded bg-teal/8 text-[7px] font-medium text-teal">{c.tag}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab Mockups ─────────────────────────────────────────── */

function TabMockup({ variant }: { variant: 'save' | 'organise' | 'share' }) {
  if (variant === 'save') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[80%] shadow-card space-y-2.5">
        <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-rose-100 to-pink-50" />
        <div className="space-y-1.5">
          <div className="h-1.5 w-3/4 bg-ink/8 rounded" />
          <div className="h-1 w-full bg-ink/4 rounded" />
          <div className="flex gap-1 mt-1">
            <span className="px-1.5 py-0.5 rounded bg-teal/8 text-[6px] text-teal font-medium">Urgency</span>
            <span className="px-1.5 py-0.5 rounded bg-surface text-[6px] text-ink/50 font-medium">Video</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'organise') return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[75%] space-y-2.5 shadow-card">
        <div className="flex items-center gap-1.5">
          <Tag size={10} className="text-teal" />
          <span className="text-[9px] font-semibold">Tags &amp; Folders</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {['Clarity', 'Proof', 'Urgency', 'Identity', 'Curiosity'].map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-teal/8 text-[7px] text-teal font-medium">{t}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {['Q4 Campaign', 'Best Performers'].map(f => (
            <span key={f} className="px-1.5 py-0.5 rounded bg-surface text-[7px] text-ink/60 font-medium border border-edge/50">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-edge p-4 max-w-[65%] text-center space-y-2 shadow-card">
        <ShareNetwork size={16} className="text-teal mx-auto" />
        <div className="h-2 w-20 bg-ink/10 rounded mx-auto" />
        <div className="h-6 w-full rounded-lg bg-surface border border-edge flex items-center px-2">
          <span className="text-[7px] text-faint truncate">https://app.agencyviz.io/swipe/board123</span>
        </div>
        <div className="h-7 w-24 rounded-lg bg-teal mx-auto" />
      </div>
    </div>
  );
}
