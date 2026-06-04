'use client';

import { type ComponentProps, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

const footerLinks = [
  {
    label: 'Product',
    links: [
      { title: 'Features', href: '/home#tools' },
      { title: 'Pricing', href: '/pricing' },
      { title: 'FAQ', href: '/home#faq' },
    ],
  },
  {
    label: 'Support',
    links: [
      { title: 'Help', href: '/support' },
      { title: 'Contact', href: 'mailto:support@agencyviz.io' },
      { title: 'Sign In', href: 'https://app.agencyviz.io/login', external: true },
    ],
  },
  {
    label: 'Legal',
    links: [
      { title: 'Privacy Policy', href: '/privacy-policy' },
      { title: 'Terms of Service', href: '/terms-and-conditions' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative w-full bg-teal">

      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
          <AnimatedContainer className="space-y-4">
            <img src="/logo-agencyviz.svg" alt="AgencyViz" className="h-6 brightness-0 invert" />
            <p className="text-sm text-white/70 leading-relaxed">
              The agency toolbox. Proposals, quotes, creative review, and
              everything your clients see, in one place.
            </p>
            <p className="text-xs text-white/50">
              &copy; {new Date().getFullYear()} AgencyViz.io. All rights reserved.
            </p>
          </AnimatedContainer>

          <div className="grid grid-cols-3 gap-8 lg:col-span-2">
            {footerLinks.map((section, index) => (
              <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
                  {section.label}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map(link => (
                    <li key={link.title}>
                      {'external' in link && link.external ? (
                        <a
                          href={link.href}
                          className="text-sm text-white/70 hover:text-white transition-colors"
                        >
                          {link.title}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-white/70 hover:text-white transition-colors"
                        >
                          {link.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </AnimatedContainer>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function AnimatedContainer({
  className,
  delay = 0.1,
  children,
}: {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
