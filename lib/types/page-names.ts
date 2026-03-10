// lib/types/page-names.ts

export type PageNameEntry = {
  name: string;
  indent: number; // 0 = top level, 1 = nested child
  type?: 'page' | 'group'; // 'group' = section header only (no navigable page), default 'page'
  link_url?: string;   // optional external link attached to this page
  link_label?: string; // display label for the link button (defaults to 'View Resource')
  orientation?: 'portrait' | 'landscape';
};

/**
 * Normalize page_names from DB into PageNameEntry[].
 * Handles both legacy string[] and new {name, indent}[] formats.
 */
export function normalizePageNames(raw: unknown, count: number): PageNameEntry[] {
  const result: PageNameEntry[] = [];

  if (Array.isArray(raw)) {
    for (let i = 0; i < count; i++) {
      const item = raw[i];
      if (item && typeof item === 'object' && 'name' in item) {
        const obj = item as Record<string, unknown>;
        result.push({
          name: (obj.name as string) || `Page ${i + 1}`,
          indent: (obj.indent as number) || 0,
          ...(obj.type === 'group' ? { type: 'group' as const } : {}),
          ...(obj.link_url ? { link_url: obj.link_url as string } : {}),
          ...(obj.link_label ? { link_label: obj.link_label as string } : {}),
          ...(obj.orientation && obj.orientation !== 'auto' ? { orientation: obj.orientation as 'portrait' | 'landscape' } : {}),
        });
      } else if (typeof item === 'string') {
        result.push({ name: item, indent: 0 });
      } else {
        result.push({ name: `Page ${i + 1}`, indent: 0 });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      result.push({ name: `Page ${i + 1}`, indent: 0 });
    }
  }

  return result.slice(0, count);
}

/**
 * Convert a 0-based PDF page index to the corresponding index in the entries array,
 * skipping over group entries that don't map to PDF pages.
 * Returns -1 if not found.
 */
export function pdfIndexToEntryIndex(entries: PageNameEntry[], pdfIndex: number): number {
  let pdfCount = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].type === 'group') continue;
    if (pdfCount === pdfIndex) return i;
    pdfCount++;
  }
  return -1;
}

/**
 * Normalize page_names from DB into PageNameEntry[], preserving groups.
 * Unlike normalizePageNames (which limits to `count` entries), this preserves
 * ALL entries including groups, only padding non-group entries to match `pdfCount`.
 */
export function normalizePageNamesWithGroups(raw: unknown, pdfCount: number): PageNameEntry[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: pdfCount }, (_, i) => ({ name: `Page ${i + 1}`, indent: 0 }));
  }

  const result: PageNameEntry[] = [];
  let realPagesSeen = 0;

  for (const item of raw) {
    if (item && typeof item === 'object' && 'name' in item) {
      const obj = item as Record<string, unknown>;
      const isGroup = obj.type === 'group';
      result.push({
        name: (obj.name as string) || (isGroup ? 'Section' : `Page ${realPagesSeen + 1}`),
        indent: (obj.indent as number) || 0,
        ...(isGroup ? { type: 'group' as const } : {}),
        ...(obj.link_url ? { link_url: obj.link_url as string } : {}),
        ...(obj.link_label ? { link_label: obj.link_label as string } : {}),
        ...(obj.orientation && obj.orientation !== 'auto'
          ? { orientation: obj.orientation as 'portrait' | 'landscape' }
          : {}),
      });
      if (!isGroup) realPagesSeen++;
    } else if (typeof item === 'string') {
      result.push({ name: item || `Page ${realPagesSeen + 1}`, indent: 0 });
      realPagesSeen++;
    }
  }

  // Pad if we have fewer real pages than pdfCount
  while (realPagesSeen < pdfCount) {
    result.push({ name: `Page ${realPagesSeen + 1}`, indent: 0 });
    realPagesSeen++;
  }

  return result;
}