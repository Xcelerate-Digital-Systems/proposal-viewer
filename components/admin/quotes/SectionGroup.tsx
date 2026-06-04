'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionGroupProps {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function SectionGroup({
  id,
  label,
  isOpen,
  onToggle,
  children,
}: SectionGroupProps) {
  return (
    <div id={id} className="scroll-mt-14">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex items-center gap-2 w-full pb-2"
      >
        <ChevronRight
          size={12}
          className={`text-dim shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <span className="text-xs font-semibold text-dim">{label}</span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
