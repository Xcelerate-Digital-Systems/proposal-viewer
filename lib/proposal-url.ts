// lib/proposal-url.ts

/**
 * Build the public viewer URL for a proposal.
 * Uses the company's custom domain if verified, otherwise falls back to the app URL.
 */
export function buildProposalUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/view/${shareToken}`;
  }
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/view/${shareToken}`;
}

/**
 * Build the public viewer URL for a document.
 * Uses the company's custom domain if verified, otherwise falls back to the app URL.
 */
export function buildDocumentUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/doc/${shareToken}`;
  }
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/doc/${shareToken}`;
}

/**
 * Build the public URL for a creative review PROJECT (card grid of all items).
 * Always uses the main app domain — custom domains are only for proposals/documents.
 *
 * Signature keeps customDomain param for backward compat but ignores it.
 */
export function buildReviewProjectUrl(
  shareToken: string,
  _customDomain?: string | null,
  fallbackOrigin?: string
): string {
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/project/${shareToken}`;
}

/**
 * Build the public URL for a single review ITEM (detail view with comments).
 * Always uses the main app domain.
 */
export function buildReviewItemUrl(
  shareToken: string,
  _customDomain?: string | null,
  fallbackOrigin?: string
): string {
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/review/${shareToken}`;
}

/**
 * Build the public URL for a review WHITEBOARD (React Flow canvas).
 * Always uses the main app domain.
 */
export function buildReviewWhiteboardUrl(
  shareToken: string,
  _customDomain?: string | null,
  fallbackOrigin?: string
): string {
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/whiteboard/${shareToken}`;
}

/**
 * @deprecated Use buildReviewProjectUrl, buildReviewItemUrl, or buildReviewWhiteboardUrl instead.
 */
export function buildReviewUrl(
  shareToken: string,
  _customDomain?: string | null,
  fallbackOrigin?: string
): string {
  return buildReviewProjectUrl(shareToken, null, fallbackOrigin);
}