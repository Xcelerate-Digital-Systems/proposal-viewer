'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Layers, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Funnel, FunnelTab } from '@/lib/supabase';

interface Props {
  currentFunnelId: string;
  linkedFunnelId: string | null;
  onLink: (funnelId: string | null) => void;
  tabs?: FunnelTab[];
  currentTabId?: string | null;
  linkedTabId?: string | null;
  onLinkTab?: (tabId: string | null) => void;
}

export default function FunnelLinkPicker({
  currentFunnelId, linkedFunnelId, onLink,
  tabs, currentTabId, linkedTabId, onLinkTab,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [funnels, setFunnels] = useState<Pick<Funnel, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const siblingTabs = (tabs || []).filter((t) => t.id !== currentTabId);
  const hasTabLink = !!linkedTabId;
  const hasFunnelLink = !!linkedFunnelId;
  const hasAnyLink = hasTabLink || hasFunnelLink;

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

  const linkedFunnelName = linkedFunnelId
    ? funnels.find((f) => f.id === linkedFunnelId)?.name
    : null;
  const linkedTabName = linkedTabId
    ? tabs?.find((t) => t.id === linkedTabId)?.name
    : null;

  const filtered = query.trim()
    ? funnels.filter((f) => f.name.toLowerCase().includes(query.toLowerCase().trim()))
    : funnels;

  const clearAll = () => {
    onLink(null);
    onLinkTab?.(null);
  };

  const selectTab = (tabId: string) => {
    onLink(null);
    onLinkTab?.(tabId);
    setOpen(false);
    setQuery('');
  };

  const selectFunnel = (funnelId: string) => {
    onLinkTab?.(null);
    onLink(funnelId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">
        {siblingTabs.length > 0 ? 'Link to tab or funnel' : 'Linked funnel'}
      </label>
      <div className="relative" ref={popoverRef}>
        {hasAnyLink ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-edge text-caption text-left hover:border-teal transition-colors min-w-0"
            >
              {hasTabLink ? (
                <Layers size={12} className="text-teal shrink-0" />
              ) : (
                <ArrowUpRight size={12} className="text-teal shrink-0" />
              )}
              <span className="truncate">
                {hasTabLink ? linkedTabName || 'Linked tab' : linkedFunnelName || 'Linked funnel'}
              </span>
              <ChevronDown size={11} className="text-muted ml-auto shrink-0" />
            </button>
            {hasFunnelLink && (
              <button
                type="button"
                onClick={() => router.push(`/funnels/${linkedFunnelId}`)}
                className="w-8 h-8 rounded-lg border border-edge text-muted hover:text-teal hover:bg-surface flex items-center justify-center transition-colors shrink-0"
                title="Go to linked funnel"
              >
                <ArrowUpRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
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
            <span>{siblingTabs.length > 0 ? 'Link to tab or funnel…' : 'Link to another funnel…'}</span>
          </button>
        )}

        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-edge rounded-lg shadow-xl max-h-[300px] flex flex-col">
            <div className="px-2 pt-2 pb-1 border-b border-edge">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full px-2 py-1 rounded border border-edge text-detail outline-none focus:border-teal"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {/* Tabs section */}
              {siblingTabs.length > 0 && (
                <>
                  <div className="px-3 py-1 text-2xs uppercase tracking-wider font-semibold text-muted">
                    Tabs in this funnel
                  </div>
                  {siblingTabs
                    .filter((t) => !query.trim() || t.name.toLowerCase().includes(query.toLowerCase().trim()))
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTab(t.id)}
                        className={`w-full text-left px-3 py-1.5 text-detail hover:bg-surface transition-colors truncate flex items-center gap-1.5 ${
                          t.id === linkedTabId ? 'text-teal font-medium' : 'text-ink'
                        }`}
                      >
                        <Layers size={11} className="shrink-0 text-muted" />
                        {t.name}
                      </button>
                    ))}
                  <div className="mx-3 my-1 border-t border-edge" />
                </>
              )}

              {/* Funnels section */}
              <div className="px-3 py-1 text-2xs uppercase tracking-wider font-semibold text-muted">
                Other funnels
              </div>
              {loading ? (
                <p className="text-detail text-muted px-3 py-2">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-detail text-muted px-3 py-2">No funnels found</p>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFunnel(f.id)}
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
