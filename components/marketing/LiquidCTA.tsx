'use client';

import { ArrowRight } from '@phosphor-icons/react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export function LiquidCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <LiquidButton asChild size="xl" className="text-white font-semibold">
      <a href={href} className="gap-2">
        {children} <ArrowRight size={16} weight="bold" />
      </a>
    </LiquidButton>
  );
}
