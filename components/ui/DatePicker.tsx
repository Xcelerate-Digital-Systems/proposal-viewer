'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  children: React.ReactNode;
}

export default function DatePicker({ value, onChange, children }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const popW = 304;
    const popH = 340;
    const top = r.bottom + 6 + popH > window.innerHeight
      ? Math.max(8, r.top - popH - 6)
      : r.bottom + 6;
    const left = Math.min(r.left, window.innerWidth - popW - 8);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePos();
          setOpen((v) => !v);
        }}
        className="cursor-pointer"
      >
        {children}
      </div>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 rounded-xl bg-white border border-edge shadow-[0_10px_40px_-12px_rgba(15,23,42,0.2),0_4px_12px_-4px_rgba(15,23,42,0.06)] animate-[datePickerIn_120ms_ease-out]"
          style={{ top: pos.top, left: pos.left }}
        >
          <style>{`
            @keyframes datePickerIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .av-datepicker .rdp-root {
              --rdp-accent-color: #017C87;
              --rdp-accent-background-color: #E6F5F3;
              --rdp-day-height: 36px;
              --rdp-day-width: 36px;
              --rdp-day_button-height: 34px;
              --rdp-day_button-width: 34px;
              --rdp-day_button-border-radius: 8px;
              --rdp-day_button-border: 2px solid transparent;
              --rdp-selected-border: 2px solid #017C87;
              --rdp-today-color: #017C87;
              --rdp-nav-height: 2.5rem;
              --rdp-nav_button-height: 2rem;
              --rdp-nav_button-width: 2rem;
              --rdp-outside-opacity: 0.35;
              --rdp-animation_duration: 0.15s;
              font-family: 'Manrope', sans-serif;
              font-size: 13px;
              padding: 12px;
            }

            .av-datepicker .rdp-month_caption {
              font-size: 14px;
              font-weight: 600;
              color: #1E2432;
              height: 2.5rem;
            }

            .av-datepicker .rdp-weekday {
              font-size: 11px;
              font-weight: 600;
              color: #8C8C8C;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              padding: 4px 0;
            }

            .av-datepicker .rdp-day_button {
              font-size: 13px;
              font-weight: 500;
              color: #1E2432;
              transition: background-color 120ms, color 120ms;
            }

            .av-datepicker .rdp-day_button:hover {
              background-color: #F5F5F5;
            }

            .av-datepicker .rdp-today:not(.rdp-outside) .rdp-day_button {
              font-weight: 700;
              color: #017C87;
            }

            .av-datepicker .rdp-selected .rdp-day_button {
              background-color: #017C87;
              color: white;
              font-weight: 600;
              border-color: #017C87;
            }

            .av-datepicker .rdp-selected .rdp-day_button:hover {
              background-color: #016670;
            }

            .av-datepicker .rdp-chevron {
              fill: #6B7280;
            }

            .av-datepicker .rdp-button_previous:hover .rdp-chevron,
            .av-datepicker .rdp-button_next:hover .rdp-chevron {
              fill: #1E2432;
            }

            .av-datepicker .rdp-button_previous,
            .av-datepicker .rdp-button_next {
              border-radius: 8px;
              transition: background-color 120ms;
            }

            .av-datepicker .rdp-button_previous:hover,
            .av-datepicker .rdp-button_next:hover {
              background-color: #F5F5F5;
            }

            .av-datepicker .rdp-outside .rdp-day_button {
              color: #8C8C8C;
            }
          `}</style>
          <div className="av-datepicker">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              showOutsideDays
              fixedWeeks
              defaultMonth={selected}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
