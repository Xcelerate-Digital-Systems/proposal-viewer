'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CaretDown,
  FileText, ChatDots, FlowArrow, BookmarkSimple, Plug,
} from '@phosphor-icons/react';

const PRODUCTS = [
  { label: 'Pitch', href: '/home/pitch', desc: 'Proposals, quotes, docs & templates', icon: FileText },
  { label: 'Markup', href: '/home/markup', desc: 'Creative review & feedback', icon: ChatDots },
  { label: 'Funnel Planner', href: '/home/funnel-planner', desc: 'Visual campaign mapping', icon: FlowArrow },
  { label: 'Swipe Vault', href: '/home/swipe-vault', desc: 'Save & organise ad inspiration', icon: BookmarkSimple },
  { label: 'Integrations', href: '/home/integrations', desc: 'Looker Studio connector', icon: Plug },
];

function useScrolled(threshold = 8) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let node: HTMLElement | null = ref.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      node = node.parentElement;
    }
    const target: HTMLElement | Window = node ?? window;
    const top = () => (node ? node.scrollTop : window.scrollY);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const now = top() > threshold;
        setScrolled((prev) => (prev === now ? prev : now));
      });
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      target.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [threshold]);

  return { ref, scrolled };
}

export function SiteHeader({
  publicSignupOn,
  anchors,
}: {
  publicSignupOn: boolean;
  anchors?: { label: string; href: string }[];
}) {
  const { ref, scrolled } = useScrolled(8);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ctaHref = publicSignupOn ? 'https://app.agencyviz.io/signup' : '/pricing';
  const ctaLabel = publicSignupOn ? 'Start free trial' : 'Get early access';

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <header
      ref={ref}
      className={`sticky top-0 z-50 transition-[background-color,padding] duration-300 ease-out ${
        scrolled ? 'bg-transparent px-4 pt-3' : 'bg-surface-dark'
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-between text-white transition-all duration-300 ease-out ${
          scrolled
            ? 'max-w-4xl h-12 px-4 rounded-2xl bg-surface-dark/95 supports-[backdrop-filter]:bg-surface-dark/80 backdrop-blur-lg border border-surface-dark-border shadow-lg shadow-ink/25'
            : 'max-w-6xl h-16 px-6 border-b border-surface-dark-border'
        }`}
      >
        <Link href="/home" className="inline-flex shrink-0">
          <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-6" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Products dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                dropdownOpen ? 'text-white bg-white/10' : 'text-white/70 hover:text-white'
              }`}
            >
              Products
              <CaretDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-surface-dark border border-surface-dark-border shadow-lg shadow-ink/30 overflow-hidden animate-enter-up">
                <div className="p-2">
                  {PRODUCTS.map(p => (
                    <Link
                      key={p.label}
                      href={p.href}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                        <p.icon size={16} weight="duotone" className="text-surface-dark-accent" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{p.label}</div>
                        <div className="text-xs text-white/40">{p.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {anchors ? (
            anchors.map(a => (
              <a key={a.href} href={a.href} className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg">
                {a.label}
              </a>
            ))
          ) : (
            <Link href="/pricing" className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg">
              Pricing
            </Link>
          )}
          <a
            href="https://app.agencyviz.io/login"
            className="px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Sign in
          </a>
          <a
            href={ctaHref}
            className="press-scale ml-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-teal text-sm font-semibold hover:bg-white/90 transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark focus-visible:outline-none"
          >
            {ctaLabel} <ArrowRight size={14} weight="bold" />
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-white hover:bg-white/10 transition-colors"
        >
          <MenuToggleIcon open={mobileOpen} />
        </button>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden mx-4 mt-2 rounded-2xl bg-surface-dark border border-surface-dark-border shadow-lg shadow-ink/25 overflow-hidden animate-enter-up">
          <nav className="flex flex-col p-3">
            <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-white/30">Products</div>
            {PRODUCTS.map((p) => (
              <Link
                key={p.label}
                href={p.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <p.icon size={15} weight="duotone" className="text-surface-dark-accent/70" />
                {p.label}
              </Link>
            ))}
            <div className="h-px bg-surface-dark-border my-2" />
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              Pricing
            </Link>
            <a href="https://app.agencyviz.io/login" className="px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              Sign in
            </a>
            <a
              href={ctaHref}
              className="press-scale mt-2 inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-white text-teal text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              {ctaLabel} <ArrowRight size={15} weight="bold" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-5 transition-transform duration-300 ease-in-out ${open ? '-rotate-45' : ''}`}
    >
      <path
        className="transition-all duration-300 ease-in-out"
        style={
          open
            ? { strokeDasharray: '20 300', strokeDashoffset: '-32.42px' }
            : { strokeDasharray: '12 63' }
        }
        d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
      />
      <path d="M7 16 27 16" />
    </svg>
  );
}
