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
 * Uses the project's share_token → /project/[token]
 */
export function buildReviewProjectUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/project/${shareToken}`;
  }
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/project/${shareToken}`;
}

/**
 * Build the public URL for a single review ITEM (detail view with comments).
 * Uses the item's share_token → /review/[token]
 */
export function buildReviewItemUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/review/${shareToken}`;
  }
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/review/${shareToken}`;
}

/**
 * Build the public URL for a review WHITEBOARD (React Flow canvas).
 * Uses the project's board_share_token → /whiteboard/[token]
 */
export function buildReviewWhiteboardUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/whiteboard/${shareToken}`;
  }
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/whiteboard/${shareToken}`;
}

/**
 * @deprecated Use buildReviewProjectUrl, buildReviewItemUrl, or buildReviewWhiteboardUrl instead.
 * Kept for backward compatibility during migration.
 */
export function buildReviewUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  return buildReviewProjectUrl(shareToken, customDomain, fallbackOrigin);
}