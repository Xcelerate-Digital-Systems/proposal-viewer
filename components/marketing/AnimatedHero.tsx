'use client';

// Animated marketing hero. Flowing SVG "paths" backdrop (brand teal) +
// kinetic per-letter title reveal. Motion is isolated here as a client leaf
// so app/home/page.tsx stays a server component. Honors prefers-reduced-motion.

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { buttonClasses } from '@/components/ui/buttonClasses';

function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.7 + i * 0.05,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none text-teal">
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
    { text: 'Everything your clients see,', className: 'text-ink' },
    { text: 'in one place.', className: 'text-teal' },
  ];
  let globalIndex = 0;

  return (
    <section className="relative overflow-hidden border-b border-edge/50 min-h-[88dvh] flex items-center">
      {/* Paths backdrop */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} animate={animate} />
        <FloatingPaths position={-1} animate={animate} />
      </div>
      {/* Readability wash — light enough that the paths still read */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/30 to-white pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 52% 44% at 50% 44%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 45%, transparent 75%)' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center w-full">
        <motion.span
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal bg-teal/8 border border-teal/15 rounded-full px-3.5 py-1.5"
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
          className="mt-6 text-lg text-prose max-w-2xl mx-auto leading-relaxed"
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
          <Link href="/pricing" className={`${buttonClasses({ variant: 'primary', size: 'lg' })} press-scale`}>
            {publicSignupOn ? 'Start your free trial' : 'See pricing'} <ArrowRight size={16} weight="bold" />
          </Link>
          <a href="https://app.agencyviz.io/login" className={`${buttonClasses({ variant: 'secondary', size: 'lg' })} press-scale`}>
            Sign in
          </a>
        </motion.div>
      </div>
    </section>
  );
}
