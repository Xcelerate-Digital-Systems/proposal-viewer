'use client';

import { useState, useId } from 'react';
import { CaretDown } from '@phosphor-icons/react';

interface FAQItem {
  q: string;
  a: string;
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const id = useId();

  return (
    <div className="divide-y divide-edge">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        const buttonId = `${id}-faq-btn-${i}`;
        const panelId = `${id}-faq-panel-${i}`;
        return (
          <div key={i}>
            <button
              id={buttonId}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="w-full flex items-center justify-between gap-4 py-5 text-left group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="text-sm font-semibold text-ink group-hover:text-teal transition-colors">
                {item.q}
              </span>
              <CaretDown
                size={16}
                weight="bold"
                className={`shrink-0 text-dim transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-all duration-300 ease-out ${
                isOpen
                  ? 'grid-rows-[1fr] opacity-100 pb-5'
                  : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-sm text-prose leading-relaxed pr-8">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
