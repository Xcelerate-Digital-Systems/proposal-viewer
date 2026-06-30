// app/templates/templates-types.ts
// Shared types, constants, and helpers for the Templates page.

export type TabKey = 'proposal' | 'quote' | 'line_items' | 'packages' | 'pages';

export interface LineItemTemplateRow {
  id: string;
  name: string;
  description: string | null;
  items: unknown[];
  created_at: string;
}

export interface PackageTemplateRow {
  id: string;
  name: string;
  description: string | null;
  tier: { name?: string; features?: unknown[] } | null;
  created_at: string;
}

export interface PageLibraryRow {
  id: string;
  type: string;
  title: string;
  label: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'proposal', label: 'Proposals' },
  { key: 'quote', label: 'Quotes' },
  { key: 'line_items', label: 'Line items' },
  { key: 'packages', label: 'Packages' },
  { key: 'pages', label: 'Pages' },
];

export type SortKey = 'updated' | 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export function sortItems<T extends { name?: string; title?: string; created_at: string; updated_at?: string }>(
  items: T[],
  sortBy: SortKey,
): T[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return ((b as { updated_at?: string }).updated_at || b.created_at).localeCompare(
          (a as { updated_at?: string }).updated_at || a.created_at,
        );
      case 'newest':
        return b.created_at.localeCompare(a.created_at);
      case 'oldest':
        return a.created_at.localeCompare(b.created_at);
      case 'name_asc':
        return (a.name || a.title || '').localeCompare(b.name || b.title || '');
      case 'name_desc':
        return (b.name || b.title || '').localeCompare(a.name || a.title || '');
      default:
        return 0;
    }
  });
}
