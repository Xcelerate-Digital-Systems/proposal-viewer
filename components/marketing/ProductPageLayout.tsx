'use client';

import {
  useState, useId, useRef, useEffect,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CaretDown } from '@phosphor-icons/react';
import {
  motion, useReducedMotion, AnimatePresence,
} from 'framer-motion';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { FAQAccordion } from './FAQAccordion';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

const PUBLIC_SIGNUP_ON = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true';

/* ── Types ────────────────────────────────────────────────────────── */

interface UseCase { title: string; desc: string; gradient: string }
interface CoreTab { label: string; title: string; desc: string; mockup: ReactNode }
interface Feature { icon: React.ElementType; title: string; desc: string; gradient?: string; mockup?: ReactNode }
interface FAQ { q: string; a: string }

interface ProductPageProps {
  icon: React.ElementType;
  name: string;
  headline: string;
  headlineAccent?: string;
  subtext: string;
  heroMockup: ReactNode;
  whyHeading: string;
  whySubtext: string;
  beforeLabel: string;
  beforeDesc: string;
  afterLabel: string;
  afterDesc: string;
  useCases: UseCase[];
  coreTabs: CoreTab[];
  features: Feature[];
  testimonial?: { quote: string; name: string; role: string; initials: string };
  faqs: FAQ[];
}

/* ── Reveal ───────────────────────────────────────────────────────── */

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── FloatingPaths (reused from AnimatedHero) ─────────────────────── */

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

/* ── ContainerScroll (hero device frame) ──────────────────────────── */

function HeroScroll({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <div className="pt-16 md:pt-28 pb-0 px-2 md:px-16">
      <div className="max-w-5xl mx-auto text-center mb-10">{title}</div>
      <div
        className="max-w-5xl mx-auto w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-t-[30px] shadow-2xl overflow-hidden"
        style={{ maxHeight: '32rem' }}
      >
        <div className="w-full overflow-hidden rounded-t-2xl bg-white md:rounded-t-2xl md:p-4 aspect-[16/10]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Grid-pattern FeatureCard ─────────────────────────────────────── */

function GridPattern({ width, height, x, y, squares, ...props }:
  React.ComponentProps<'svg'> & { width: number; height: number; x: string; y: string; squares?: number[][] }
) {
  const patternId = useId();
  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy], i) => (
            <rect key={i} strokeWidth="0" width={width + 1} height={height + 1} x={sx * width} y={sy * height} />
          ))}
        </svg>
      )}
    </svg>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  const squares = [[8 + (index % 3), 2 + (index % 4)], [9 + (index % 2), 4 + (index % 3)], [7 + (index % 4), 1 + (index % 5)], [10, 3 + (index % 2)], [8, 5 + (index % 3)]];

  return (
    <div className="relative overflow-hidden p-6">
      <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
        <div className="absolute inset-0 bg-gradient-to-r from-teal/[0.03] to-teal/[0.01] [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] opacity-100">
          <GridPattern
            width={20} height={20} x="-12" y="4" squares={squares}
            className="fill-teal/[0.04] stroke-teal/[0.15] absolute inset-0 h-full w-full mix-blend-overlay"
          />
        </div>
      </div>

      {/* Mini mockup or icon */}
      {feature.mockup ? (
        <div className="relative h-20 mb-4 rounded-lg border border-edge/50 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {feature.mockup}
        </div>
      ) : (
        <Icon className="text-teal/70 size-6 relative" weight="duotone" aria-hidden />
      )}

      <h3 className="relative mt-2 text-sm md:text-base font-semibold text-ink">{feature.title}</h3>
      <p className="relative z-20 mt-2 text-xs text-muted leading-relaxed">{feature.desc}</p>
    </div>
  );
}

/* ── Layout ───────────────────────────────────────────────────────── */

export function ProductPageLayout({
  icon: Icon, name, headline, headlineAccent, subtext, heroMockup,
  whyHeading, whySubtext, beforeLabel, beforeDesc, afterLabel, afterDesc,
  useCases, coreTabs, features, testimonial, faqs,
}: ProductPageProps) {
  const reduce = useReducedMotion();
  const animate = !reduce;

  let charIdx = 0;
  const heroLines = headlineAccent
    ? [{ text: headline, color: 'text-white' }, { text: headlineAccent, color: 'text-white/80' }]
    : [{ text: headline, color: 'text-white' }];

  const heroTitle = (
    <>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
        {heroLines.map((line, li) => (
          <span key={li} className={`block ${line.color}`}>
            {line.text.split('').map((char) => {
              const d = 0.15 + charIdx * 0.02;
              charIdx += 1;
              return char === ' ' ? (
                <span key={charIdx} className="inline-block">&nbsp;</span>
              ) : (
                <motion.span
                  key={charIdx}
                  initial={animate ? { y: 50, opacity: 0 } : false}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: d, type: 'spring', stiffness: 160, damping: 24 }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        ))}
      </h1>
      <motion.p
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.7 }}
        className="mt-4 text-sm md:text-base text-white/70 max-w-xl mx-auto leading-relaxed"
      >
        {subtext}
      </motion.p>
      <motion.div
        initial={animate ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="mt-6"
      >
        <LiquidButton asChild size="xl" className="text-white font-semibold">
          <Link href={PUBLIC_SIGNUP_ON ? 'https://app.agencyviz.io/signup' : '/pricing'} className="gap-2">
            {PUBLIC_SIGNUP_ON ? 'Start free trial' : 'See pricing'} <ArrowRight size={16} weight="bold" />
          </Link>
        </LiquidButton>
      </motion.div>
    </>
  );

  return (
    <div className="h-[100dvh] overflow-y-auto bg-white">
      <SiteHeader publicSignupOn={PUBLIC_SIGNUP_ON} />

      {/* ── 1. Hero with FloatingPaths + ContainerScroll ──── */}
      <section className="relative overflow-hidden min-h-[100dvh] flex flex-col justify-center bg-gradient-to-br from-[#017C87] via-[#016670] to-[#043946]">
        <div className="absolute inset-0">
          <FloatingPaths position={1} animate={animate} />
          <FloatingPaths position={-1} animate={animate} />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 52% 44% at 50% 44%, rgba(1,124,135,0.4) 0%, transparent 65%)' }}
        />
        <div className="relative z-10">
          <HeroScroll title={heroTitle}>{heroMockup}</HeroScroll>
        </div>
      </section>

      {/* ── 2. Why + Before/After ──────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6">
          <Reveal className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">{whyHeading}</h2>
            <p className="mt-4 text-prose max-w-xl mx-auto leading-relaxed">{whySubtext}</p>
          </Reveal>
          <Reveal>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-8 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Before</span>
                <h3 className="mt-3 text-lg font-bold text-ink">{beforeLabel}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{beforeDesc}</p>
              </div>
              <div className="rounded-2xl border border-teal/20 bg-teal/[0.03] p-8 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">After AgencyViz</span>
                <h3 className="mt-3 text-lg font-bold text-ink">{afterLabel}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{afterDesc}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3. Use Cases ──────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-surface/40 border-y border-edge/50">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">Use Cases</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">Upgrade your workflow.</h2>
          </Reveal>
          <Reveal>
            <div className="grid md:grid-cols-3 gap-5">
              {useCases.map(uc => (
                <div key={uc.title} className="rounded-2xl border border-edge bg-white p-6 hover-lift">
                  <div className={`h-28 rounded-xl bg-gradient-to-br ${uc.gradient} mb-4`} />
                  <h3 className="text-base font-semibold text-ink">{uc.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 4. Core Features (tabbed) ─────────────────────── */}
      {coreTabs.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-6">
            <Reveal className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">Core Features</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">How it works.</h2>
            </Reveal>
            <CoreFeatureTabs tabs={coreTabs} />
          </div>
        </section>
      )}

      {/* ── 5. Feature grid — single section, all features ── */}
      <section className="py-12 md:py-16 bg-surface/40 border-y border-edge/50">
        <div className="mx-auto w-full max-w-5xl px-4">
          <Reveal className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal">All Features</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-ink tracking-tight">{name} features.</h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="grid grid-cols-1 divide-x divide-y divide-dashed border border-dashed sm:grid-cols-2 md:grid-cols-3">
              {features.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 6. Testimonial ────────────────────────────────── */}
      {testimonial && (
        <section className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-6">
            <Reveal>
              <div className="bg-surface-dark rounded-2xl p-8 md:p-10 text-center">
                <p className="text-base md:text-lg text-white/90 leading-relaxed italic">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-dark-accent/20 flex items-center justify-center text-sm font-bold text-surface-dark-accent">{testimonial.initials}</div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{testimonial.name}</p>
                    <p className="text-xs text-surface-dark-accent/60">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 7. Mid-page CTA ───────────────────────────────── */}
      <section className="py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <div className="w-20 h-20 rounded-3xl bg-teal/10 flex items-center justify-center mx-auto mb-6">
              <Icon size={40} weight="duotone" className="text-teal" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink tracking-tight">Get a 7-day free trial today.</h2>
            <p className="mt-4 text-prose max-w-md mx-auto leading-relaxed">{name} comes with the full AgencyViz toolkit. Delightfully all in one place.</p>
            <div className="mt-8">
              <LiquidButton asChild size="xl" className="text-white font-semibold">
                <Link href={PUBLIC_SIGNUP_ON ? 'https://app.agencyviz.io/signup' : '/pricing'} className="gap-2">
                  {PUBLIC_SIGNUP_ON ? 'Start free trial' : 'See pricing'} <ArrowRight size={16} weight="bold" />
                </Link>
              </LiquidButton>
              <p className="mt-3 text-xs text-faint">No credit card required.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 9. FAQ ────────────────────────────────────────── */}
      {faqs.length > 0 && (
        <section className="py-12 md:py-16 bg-surface/40 border-y border-edge/50">
          <div className="max-w-2xl mx-auto px-6">
            <Reveal className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal">FAQ</span>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold text-ink tracking-tight">Questions about {name}?</h2>
            </Reveal>
            <Reveal><FAQAccordion items={faqs} /></Reveal>
          </div>
        </section>
      )}

      {/* ── 10. Final CTA ─────────────────────────────────── */}
      <section className="bg-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 30% 80%, rgba(138,217,209,0.2) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(1,124,135,0.15) 0%, transparent 45%)',
        }} />
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center relative">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">Ready to get started?</h2>
            <p className="mt-4 text-base text-surface-dark-accent/60 max-w-md mx-auto leading-relaxed">Unlock AgencyViz with an unrestricted 7-day free trial.</p>
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              <LiquidButton asChild size="xl" className="text-white font-semibold">
                <Link href={PUBLIC_SIGNUP_ON ? 'https://app.agencyviz.io/signup' : '/pricing'} className="gap-2">
                  Start free trial <ArrowRight size={16} weight="bold" />
                </Link>
              </LiquidButton>
              <LiquidButton asChild size="default" className="text-white font-semibold">
                <Link href="/pricing" className="gap-2">
                  View pricing <ArrowRight size={14} weight="bold" />
                </Link>
              </LiquidButton>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Core Feature Tabs ────────────────────────────────────────────── */

function CoreFeatureTabs({ tabs }: { tabs: CoreTab[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { tabsRef.current[active]?.focus(); }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const len = tabs.length;
    if (e.key === 'ArrowRight') setActive(i => (i + 1) % len);
    else if (e.key === 'ArrowLeft') setActive(i => (i - 1 + len) % len);
    else return;
    e.preventDefault();
  };

  return (
    <Reveal>
      <div role="tablist" className="flex items-center justify-center gap-2 md:gap-4 mb-8" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button key={tab.label}
            ref={el => { tabsRef.current[i] = el; }}
            role="tab"
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active === i ? 'bg-teal text-white shadow-sm' : 'bg-surface text-muted hover:text-ink'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="rounded-2xl bg-surface/60 border border-edge p-6 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div key={active}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-ink">{tabs[active].title}</h3>
              <p className="mt-3 text-sm text-prose leading-relaxed">{tabs[active].desc}</p>
            </div>
            <div className="rounded-xl border border-edge overflow-hidden shadow-card bg-white aspect-[4/3]">{tabs[active].mockup}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Reveal>
  );
}
