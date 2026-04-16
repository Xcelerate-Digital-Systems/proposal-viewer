// components/admin/ads/swipe/AccordionSection.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
};

export default function AccordionSection({ title, icon, defaultOpen = false, badge, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-edge last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-5 py-3 text-left hover:bg-surface/50 transition-colors"
      >
        <span className="shrink-0">{icon}</span>
        <span className="text-[13px] font-semibold text-ink flex-1">{title}</span>
        {badge && (
          <span className="text-[10px] bg-teal/10 text-teal px-1.5 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        <ChevronDown
          size={14}
          className={`text-faint shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}
