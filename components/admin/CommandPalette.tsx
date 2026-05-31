'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, FileText, ReceiptText, Files, LayoutTemplate,
  MessageSquareText, Workflow, Bookmark, UserSquare2, Settings,
  LayoutDashboard, Palette, Plug,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  id: string;
  title: string;
  type: 'proposal' | 'quote' | 'document' | 'template' | 'campaign' | 'funnel' | 'client';
  href: string;
  subtitle?: string;
}

const TYPE_CONFIG = {
  proposal:  { icon: FileText,          label: 'Proposal',  color: 'text-blue-400' },
  quote:     { icon: ReceiptText,       label: 'Quote',     color: 'text-emerald-400' },
  document:  { icon: Files,             label: 'Document',  color: 'text-amber-400' },
  template:  { icon: LayoutTemplate,    label: 'Template',  color: 'text-purple-400' },
  campaign:  { icon: MessageSquareText,  label: 'Campaign',  color: 'text-rose-400' },
  funnel:    { icon: Workflow,           label: 'Funnel',    color: 'text-cyan-400' },
  client:    { icon: UserSquare2,        label: 'Client',    color: 'text-orange-400' },
} as const;

const QUICK_LINKS = [
  { label: 'Dashboard',       href: '/dashboard',                 icon: LayoutDashboard },
  { label: 'Proposals',       href: '/proposals',                 icon: FileText },
  { label: 'Quotes',          href: '/quotes',                    icon: ReceiptText },
  { label: 'Documents',       href: '/documents',                 icon: Files },
  { label: 'Templates',       href: '/templates',                 icon: LayoutTemplate },
  { label: 'Campaigns',       href: '/campaigns',                 icon: MessageSquareText },
  { label: 'Funnels',         href: '/funnels',                   icon: Workflow },
  { label: 'Swipe Vault',     href: '/ads/swipe',                 icon: Bookmark },
  { label: 'Looker Studio',   href: '/integrations/looker-studio', icon: Plug },
  { label: 'Brand Kit',       href: '/company',                   icon: Palette },
  { label: 'Settings',        href: '/settings',                  icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allItems, setAllItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      loadItems();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const loadItems = useCallback(async () => {
    if (allItems.length > 0) return;
    setLoading(true);
    try {
      const [proposals, documents, templates, campaignsRes, funnelsRes, clients] = await Promise.all([
        authFetch('/api/proposals').then((r) => r.json()).catch(() => ({ data: [] })),
        authFetch('/api/documents').then((r) => r.json()).catch(() => ({ data: [] })),
        authFetch('/api/templates').then((r) => r.json()).catch(() => ({ data: [] })),
        supabase.from('review_projects').select('id, title, client_name').order('created_at', { ascending: false }).limit(100),
        supabase.from('funnels').select('id, title, name').order('created_at', { ascending: false }).limit(100),
        authFetch('/api/clients').then((r) => r.json()).catch(() => ({ data: [] })),
      ]);
      const campaigns = { projects: campaignsRes.data || [] };
      const funnels = { data: funnelsRes.data || [] };

      const items: SearchResult[] = [];

      for (const p of proposals.data || proposals || []) {
        items.push({
          id: p.id, title: p.title || 'Untitled Proposal', type: 'proposal',
          href: `/proposals/${p.id}`, subtitle: p.client_name,
        });
        if (p.has_quote || p.quote_enabled) {
          items.push({
            id: `q-${p.id}`, title: `${p.title || 'Untitled'} — Quote`, type: 'quote',
            href: `/quotes/${p.id}`, subtitle: p.client_name,
          });
        }
      }

      for (const d of documents.data || documents || []) {
        items.push({
          id: d.id, title: d.title || 'Untitled Document', type: 'document',
          href: `/documents/${d.id}`, subtitle: d.client_name,
        });
      }

      for (const t of templates.data || templates || []) {
        items.push({
          id: t.id, title: t.title || 'Untitled Template', type: 'template',
          href: `/templates/${t.id}`,
        });
      }

      for (const c of campaigns.projects || []) {
        items.push({
          id: c.id, title: c.title || 'Untitled Campaign', type: 'campaign',
          href: `/campaigns/${c.id}/board`, subtitle: c.client_name,
        });
      }

      for (const f of funnels.data || funnels || []) {
        items.push({
          id: f.id, title: f.title || f.name || 'Untitled Funnel', type: 'funnel',
          href: `/funnels/${f.id}`,
        });
      }

      for (const cl of clients.data || clients || []) {
        items.push({
          id: cl.id, title: cl.name || 'Unnamed Client', type: 'client',
          href: `/clients`, subtitle: cl.email,
        });
      }

      setAllItems(items);
    } catch {
      // Silently fail — palette still shows quick links
    } finally {
      setLoading(false);
    }
  }, [allItems.length]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.type.includes(q)
    );
    setResults(filtered.slice(0, 20));
    setSelectedIndex(0);
  }, [query, allItems]);

  const filteredQuickLinks = query.trim()
    ? QUICK_LINKS.filter((l) => l.label.toLowerCase().includes(query.toLowerCase()))
    : QUICK_LINKS;

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = (query.trim() ? results.length : 0) + filteredQuickLinks.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && selectedIndex < results.length) {
        navigate(results[selectedIndex].href);
      } else {
        const qlIdx = selectedIndex - (query.trim() ? results.length : 0);
        if (qlIdx >= 0 && qlIdx < filteredQuickLinks.length) {
          navigate(filteredQuickLinks[qlIdx].href);
        }
      }
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  let itemIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-edge overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <Search size={18} className="text-dim shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search proposals, campaigns, clients..."
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tint text-2xs text-dim font-medium border border-edge">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-sm text-dim">Loading...</div>
          )}

          {query.trim() && results.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-faint">
                Results
              </div>
              {results.map((result) => {
                const config = TYPE_CONFIG[result.type];
                const Icon = config.icon;
                const idx = itemIndex++;
                return (
                  <button
                    key={result.id}
                    data-selected={idx === selectedIndex}
                    onClick={() => navigate(result.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      idx === selectedIndex ? 'bg-primary/10 text-ink' : 'text-dim hover:bg-tint'
                    }`}
                  >
                    <Icon size={16} className={config.color} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="truncate text-2xs text-faint">{result.subtitle}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-2xs text-faint bg-tint px-1.5 py-0.5 rounded">
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div className="py-6 text-center text-sm text-dim">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredQuickLinks.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-faint">
                {query.trim() ? 'Pages' : 'Quick Navigation'}
              </div>
              {filteredQuickLinks.map((link) => {
                const Icon = link.icon;
                const idx = itemIndex++;
                return (
                  <button
                    key={link.href}
                    data-selected={idx === selectedIndex}
                    onClick={() => navigate(link.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      idx === selectedIndex ? 'bg-primary/10 text-ink' : 'text-dim hover:bg-tint'
                    }`}
                  >
                    <Icon size={16} className="text-faint" />
                    <span className="flex-1">{link.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-edge flex items-center gap-4 text-2xs text-faint">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-tint border border-edge font-medium">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-tint border border-edge font-medium">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-tint border border-edge font-medium">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
