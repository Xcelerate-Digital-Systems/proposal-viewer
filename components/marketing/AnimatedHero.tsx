'use client';

// Animated marketing hero. Flowing SVG "paths" backdrop (brand teal) +
// kinetic per-letter title reveal. Motion is isolated here as a client leaf
// so app/home/page.tsx stays a server component. Honors prefers-reduced-motion.

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';


function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.7 + i * 0.05,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      <svg className="w-full h-full" viewBox="0 0 696 316" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.022}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={
              animate
                ? { pathLength: 1, opacity: [0.4, 0.75, 0.4], pathOffset: [0, 1, 0] }
                : { pathLength: 1, opacity: 0.55 }
            }
            transition={
              animate
                ? { duration: 20 + (path.id % 8) * 2.5, repeat: Infinity, ease: 'linear' }
                : { duration: 0 }
            }
          />
        ))}
      </svg>
    </div>
  );
}

export function AnimatedHero({ publicSignupOn }: { publicSignupOn: boolean }) {
  const reduce = useReducedMotion();
  const animate = !reduce;

  const lines = [
    { text: 'Everything your clients see.', className: 'text-white' },
    { text: 'In one place.', className: 'text-white/80' },
  ];
  let globalIndex = 0;

  return (
    <section className="relative overflow-hidden border-b border-edge/50 min-h-[100dvh] flex items-center bg-gradient-to-br from-[#017C87] via-[#016670] to-[#043946]">
      {/* Paths backdrop */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} animate={animate} />
        <FloatingPaths position={-1} animate={animate} />
      </div>
      {/* Subtle centre glow for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 52% 44% at 50% 44%, rgba(1,124,135,0.4) 0%, transparent 65%)' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center w-full">
        <motion.span
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5"
        >
          The agency toolbox
        </motion.span>

        <h1 className="mt-7 text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight leading-[1.05]">
          {lines.map((line, li) => (
            <span key={li} className={`block ${line.className}`}>
              {line.text.split('').map((char) => {
                const delay = 0.2 + globalIndex * 0.025;
                globalIndex += 1;
                return char === ' ' ? (
                  <span key={globalIndex} className="inline-block">&nbsp;</span>
                ) : (
                  <motion.span
                    key={globalIndex}
                    initial={animate ? { y: 60, opacity: 0 } : false}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay, type: 'spring', stiffness: 160, damping: 24 }}
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
          transition={{ delay: 1.1, duration: 0.7 }}
          className="mt-6 text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
        >
          Proposals, quotes, presentations, plans, and creative review.
          One workspace instead of five logins.
        </motion.p>

        <motion.div
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.6 }}
          className="mt-9 flex items-center justify-center gap-3"
        >
          <LiquidButton asChild size="xl" className="text-white font-semibold">
            <Link href="/pricing" className="gap-2">
              {publicSignupOn ? 'Start your free trial' : 'See pricing'} <ArrowRight size={16} weight="bold" />
            </Link>
          </LiquidButton>
          <a href="https://app.agencyviz.io/login" className="press-scale inline-flex items-center gap-2 h-12 px-7 rounded-lg border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors">
            Sign in
          </a>
        </motion.div>
      </div>
    </section>
  );
}
