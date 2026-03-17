// components/admin/ads/CustomSelect.tsx
'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  color?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
};

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Position the dropdown relative to the trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }, []);

  // Open handler — calculate position then show
  const handleOpen = () => {
    if (open) {
      setOpen(false);
      setSearch('');
      return;
    }
    updatePosition();
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, updatePosition]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open, searchable]);

  const current = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [options, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setSearch('');
  };

  const dropdown = open && pos ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-white rounded-xl border border-edge shadow-lg overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {/* Search */}
      {searchable && (
        <div className="px-2 pt-2 pb-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface rounded-lg border border-edge">
            <Search size={13} className="text-faint shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-[12px] text-ink placeholder-faint outline-none"
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div className="max-h-[240px] overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-faint text-center">No results</p>
        ) : (
          filtered.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`
                  w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors
                  ${selected ? 'bg-teal/5' : 'hover:bg-surface'}
                `}
              >
                {/* Color dot */}
                {opt.color && (
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <span
                    className={`block text-[13px] truncate ${
                      selected ? 'font-medium text-teal' : 'text-ink'
                    }`}
                  >
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="block text-[11px] text-faint mt-0.5 leading-tight">
                      {opt.description}
                    </span>
                  )}
                </div>

                {selected && (
                  <Check size={14} className="text-teal shrink-0 mt-0.5" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`
          w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-surface border border-edge rounded-lg text-[13px] transition-all outline-none
          ${open ? 'ring-2 ring-teal/20 border-teal/30' : 'hover:border-edge'}
          ${current ? 'text-ink' : 'text-faint'}
        `}
      >
        <span className="truncate text-left">
          {current ? current.label : placeholder}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {clearable && current && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="w-4 h-4 rounded flex items-center justify-center text-faint hover:text-muted hover:bg-edge transition-colors"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {dropdown}
    </div>
  );
}
