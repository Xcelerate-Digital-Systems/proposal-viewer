'use client';

import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-detail font-medium uppercase tracking-wider text-dim mb-1 block">{label}</span>
      {children}
    </label>
  );
}
