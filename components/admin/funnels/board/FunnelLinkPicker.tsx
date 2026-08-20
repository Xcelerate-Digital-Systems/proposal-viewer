'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Funnel } from '@/lib/supabase';

interface Props {
  currentFunnelId: string;
  linkedFunnelId: string | null;
  onLink: (funnelId: string | null) => void;
}

export default function FunnelLinkPicker({ currentFunnelId, linkedFunnelId, onLink }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [funnels, setFunnels] = useState<Pick<Funnel, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('funnels')
        .select('id, name')
        .eq('is_template', false)
        .neq('id', currentFunnelId)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (!cancelled) {
        setFunnels((data || []) as Pick<Funnel, 'id' | 'name'>[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, currentFunnelId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const linkedName = linkedFunnelId
    ? funnels.find((f) => f.id === linkedFunnelId)?.name
    : null;

  const filtered = query.trim()
    ? funnels.filter((f) => f.name.toLowerCase().includes(query.toLowerCase().trim()))
    : funnels;

  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">
        Linked funnel
      </label>
      <div className="relative" ref={popoverRef}>
        {linkedFunnelId ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-edge text-caption text-left hover:border-teal transition-colors min-w-0"
            >
              <ArrowUpRight size={12} className="text-teal shrink-0" />
              <span className="truncate">{linkedName || 'Linked funnel'}</span>
              <ChevronDown size={11} className="text-muted ml-auto shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/funnels/${linkedFunnelId}`)}
              className="w-8 h-8 rounded-lg border border-edge text-muted hover:text-teal hover:bg-surface flex items-center justify-center transition-colors shrink-0"
              title="Go to linked funnel"
            >
              <ArrowUpRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => onLink(null)}
              className="w-8 h-8 rounded-lg border border-edge text-muted hover:text-rose-500 hover:bg-surface flex items-center justify-center transition-colors shrink-0"
              title="Remove link"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-edge text-detail text-muted hover:border-teal hover:text-ink transition-colors"
          >
            <ArrowUpRight size={12} />
            <span>Link to another funnel…</span>
          </button>
        )}

        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-edge rounded-lg shadow-xl max-h-[240px] flex flex-col">
            <div className="px-2 pt-2 pb-1 border-b border-edge">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search funnels…"
                autoFocus
                className="w-full px-2 py-1 rounded border border-edge text-detail outline-none focus:border-teal"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {loading ? (
                <p className="text-detail text-muted px-3 py-2">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-detail text-muted px-3 py-2">No funnels found</p>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { onLink(f.id); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-3 py-1.5 text-detail hover:bg-surface transition-colors truncate ${
                      f.id === linkedFunnelId ? 'text-teal font-medium' : 'text-ink'
                    }`}
                  >
                    {f.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
