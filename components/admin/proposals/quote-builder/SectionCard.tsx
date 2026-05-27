// components/admin/proposals/quote-builder/SectionCard.tsx
'use client';

import { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

export default function SectionCard({ title, description, action, icon, children }: SectionCardProps) {
  return (
    <section className="bg-white rounded-2xl border border-edge-strong">
      <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-edge">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
          </div>
          {description && (
            <p className="text-xs text-faint mt-1">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
