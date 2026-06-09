'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Variant = 'fade-up' | 'slide-left' | 'slide-right' | 'scale' | 'stagger';

const VARIANT_CLASS: Record<Variant, string> = {
  'fade-up': 'reveal',
  'slide-left': 'reveal-slide-left',
  'slide-right': 'reveal-slide-right',
  'scale': 'reveal-scale',
  'stagger': 'reveal-stagger',
};

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** @deprecated Use variant="stagger" instead */
  stagger?: boolean;
  delay?: number;
  variant?: Variant;
}

export function ScrollReveal({ children, className = '', stagger, delay, variant }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  const resolvedVariant = variant ?? (stagger ? 'stagger' : 'fade-up');
  const revealClass = VARIANT_CLASS[resolvedVariant];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const add = () => el.classList.add('visible');
          if (delay) setTimeout(add, delay);
          else add();
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '-32px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`${revealClass} ${className}`}>
      {children}
    </div>
  );
}
