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
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  source?: 'local' | 'ghl';
  tags?: string[];
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

export type { Contact as AutocompleteContact };

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
  const [ghlConnected, setGhlConnected] = useState<boolean | null>(null);
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
      const [localRes, ghlRes] = await Promise.all([
        authFetch(`/api/contacts?q=${encodeURIComponent(q)}&limit=8`),
        authFetch(`/api/contacts/ghl-search?q=${encodeURIComponent(q)}&limit=8`),
      ]);

      const localContacts: Contact[] = localRes.ok
        ? ((await localRes.json()).contacts ?? []).map((c: Contact) => ({ ...c, source: 'local' as const }))
        : [];

      let ghlContacts: Contact[] = [];
      if (ghlRes.ok) {
        const ghlJson = await ghlRes.json();
        ghlContacts = (ghlJson.contacts ?? []) as Contact[];
        if (ghlJson.connected !== undefined) setGhlConnected(ghlJson.connected);
      }

      // Dedupe: if a GHL contact shares an email with a local contact, prefer local
      const localEmails = new Set(localContacts.map((c) => c.email?.toLowerCase()).filter(Boolean));
      const dedupedGhl = ghlContacts.filter((c) => !c.email || !localEmails.has(c.email.toLowerCase()));

      // Score by relevance: starts-with > word-start > contains
      const queryWords = q.toLowerCase().split(/\s+/).filter(Boolean);
      const score = (c: Contact): number => {
        const name = (c.name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        // All query words must appear somewhere in name or email
        const allMatch = queryWords.every((w) => name.includes(w) || email.includes(w));
        if (!allMatch) return -1;
        // Bonus: name starts with the full query
        if (name.startsWith(q.toLowerCase())) return 100;
        // Bonus: every query word starts a word in the name
        const nameWords = name.split(/\s+/);
        const allWordStart = queryWords.every((w) => nameWords.some((nw) => nw.startsWith(w)));
        if (allWordStart) return 80;
        // Partial: at least first query word starts a word
        if (nameWords.some((nw) => nw.startsWith(queryWords[0]))) return 60;
        // Email match
        if (email.startsWith(q.toLowerCase())) return 50;
        return 20;
      };

      const scored = [...localContacts, ...dedupedGhl]
        .map((c) => ({ contact: c, score: score(c) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const combined = scored.map((s) => s.contact);
      setSuggestions(combined);
      setOpen(combined.length > 0);
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
            {suggestions.map((c, i) => {
              const isGhl = c.source === 'ghl';
              const prevSource = i > 0 ? suggestions[i - 1].source : null;
              const showDivider = isGhl && prevSource === 'local';

              return (
                <div key={`${c.source}-${c.id}`}>
                  {showDivider && (
                    <div className="px-3 py-1.5 border-t border-edge">
                      <span className="text-[10px] font-medium text-faint uppercase tracking-wider">GoHighLevel</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                      i === highlighted ? 'bg-surface' : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isGhl ? 'bg-orange-50' : 'bg-surface'
                    }`}>
                      {isGhl ? (
                        <span className="text-[10px] font-bold text-orange-500">G</span>
                      ) : (
                        <User size={13} className="text-faint" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">
                        {c.name || c.email}
                        {c.organisation && (
                          <span className="text-faint ml-1.5">· {c.organisation}</span>
                        )}
                      </p>
                      {c.name && c.email && (
                        <p className="text-xs text-faint truncate">{c.email}</p>
                      )}
                      {c.phone && !c.email && (
                        <p className="text-xs text-faint truncate">{c.phone}</p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
            {ghlConnected === false && (
              <div className="px-3 py-1.5 border-t border-edge">
                <p className="text-[10px] text-faint">Connect GoHighLevel in Settings to search CRM contacts</p>
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
