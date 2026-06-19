'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { inputClasses } from './inputClasses';

type Contact = {
  id: string;
  email: string;
  name: string | null;
  organisation: string | null;
};

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (contact: Contact) => void;
  placeholder?: string;
  type?: 'email' | 'text';
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export default function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  type = 'email',
  className,
  autoFocus,
  disabled,
  label,
  required,
}: ContactAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await authFetch(`/api/contacts?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) return;
      const json = await res.json();
      const results = (json.contacts ?? []) as Contact[];
      setSuggestions(results);
      setOpen(results.length > 0);
      setHighlighted(-1);
    } catch {
      // silently ignore — autocomplete is non-critical
    }
  }, []);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, search]);

  const updateDropPos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
  }, []);

  useEffect(() => {
    if (open) updateDropPos();
  }, [open, updateDropPos]);

  const pick = (contact: Contact) => {
    skipNextSearch.current = true;
    onChange(contact.email);
    onSelect?.(contact);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const inputEl = (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => { if (suggestions.length > 0) { updateDropPos(); setOpen(true); } }}
      onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      className={className ?? inputClasses()}
    />
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-prose mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {inputEl}
      {open && suggestions.length > 0 && dropPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white border border-edge rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto"
            style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
          >
            {suggestions.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                  i === highlighted ? 'bg-surface' : 'hover:bg-surface/60'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center shrink-0">
                  <User size={13} className="text-faint" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">
                    {c.name || c.email}
                    {c.organisation && (
                      <span className="text-faint ml-1.5">· {c.organisation}</span>
                    )}
                  </p>
                  {c.name && (
                    <p className="text-xs text-faint truncate">{c.email}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
