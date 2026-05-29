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

export function buildReviewProjectUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  if (customDomain) return `https://${customDomain}/review/${shareToken}`;
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/review/${shareToken}`;
}

export function buildReviewItemUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  if (customDomain) return `https://${customDomain}/review/${shareToken}`;
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/review/${shareToken}`;
}

export function buildReviewWhiteboardUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  if (customDomain) return `https://${customDomain}/whiteboard/${shareToken}`;
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/whiteboard/${shareToken}`;
}

export function buildFunnelUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  if (customDomain) return `https://${customDomain}/funnel/${shareToken}`;
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/funnel/${shareToken}`;
}

export function buildSwipeUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  if (customDomain) return `https://${customDomain}/swipe/${shareToken}`;
  const origin = (fallbackOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${origin}/swipe/${shareToken}`;
}

/**
 * @deprecated Use buildReviewProjectUrl, buildReviewItemUrl, or buildReviewWhiteboardUrl instead.
 */
export function buildReviewUrl(
  shareToken: string,
  customDomain?: string | null,
  fallbackOrigin?: string
): string {
  return buildReviewProjectUrl(shareToken, customDomain, fallbackOrigin);
}