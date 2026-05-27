// Server-safe helpers for round-tripping mention pills through a comment's
// HTML content. The editor emits <span data-type="mention" data-id="..."
// data-label="...">@Name</span> nodes; the server extracts those, validates
// against the project's participant list, and persists rows in
// review_comment_mentions for the notify pipeline.
//
// Plain HTML parsing with regex is normally a footgun, but mention nodes
// are emitted by our own editor in a fixed shape — we only ever see them
// in the markup we generated. The regex below matches the exact form, with
// the attribute order our renderHTML emits, falling back to a more lenient
// matcher when the order is rearranged.

export interface ExtractedMention {
  id: string;
  label: string;
}

/**
 * Pull every mention node out of an HTML string. Returns one entry per
 * span, in document order (duplicates included — the API layer dedupes
 * by email when it stores rows).
 */
export function extractMentionsFromHtml(html: string): ExtractedMention[] {
  if (!html) return [];
  const out: ExtractedMention[] = [];
  // Match any <span ... data-type="mention" ...>. Capture the full attribute
  // string so we can pull data-id / data-label out regardless of attribute
  // ordering.
  const spanRe = /<span\b([^>]*\bdata-type="mention"[^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(html))) {
    const attrs = m[1];
    const idMatch = /\bdata-id="([^"]+)"/i.exec(attrs);
    const labelMatch = /\bdata-label="([^"]+)"/i.exec(attrs);
    if (!idMatch) continue;
    out.push({
      id: decodeHtmlEntities(idMatch[1]),
      label: decodeHtmlEntities(labelMatch?.[1] ?? idMatch[1]),
    });
  }
  return out;
}

/** Naive plain-text projection — strips all HTML tags. Used by notification
 *  emails so they don't render raw markup in subject lines / previews. */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(
    html
      // Mentions render as @Name in plain text.
      .replace(/<span\b[^>]*\bdata-type="mention"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
      // Paragraph + break boundaries become newlines so multi-paragraph
      // comments don't collapse into one run-on line.
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?p[^>]*>/gi, '')
      // Strip any remaining tags — we only ever emit paragraphs + mentions
      // + hard breaks from MentionEditor, but be defensive.
      .replace(/<[^>]+>/g, '')
  ).trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Heuristic: a stored comment is "rich" (contains TipTap markup) when it
 * starts with an HTML tag we know the editor emits. Older comments and
 * widget comments are plain text and need different rendering.
 */
export function isRichComment(content: string): boolean {
  if (!content) return false;
  const t = content.trimStart();
  return t.startsWith('<p') || t.startsWith('<span');
}
