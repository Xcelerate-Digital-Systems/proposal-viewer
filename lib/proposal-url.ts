// lib/proposal-url.ts

/**
 * Build the public viewer URL for a proposal.
 * Uses the company's custom domain if verified, otherwise falls back to the app URL.
 *
 * @param shareToken - The proposal's share token
 * @param customDomain - The company's verified custom domain (e.g. "proposals.clientco.com"), or null
 * @param fallbackOrigin - Fallback origin (e.g. window.location.origin or NEXT_PUBLIC_APP_URL)
 */
export function buildProposalUrl(
  shareToken: string,
  customDomain: string | null | undefined,
  fallbackOrigin: string
): string {
  if (customDomain) {
    return `https://${customDomain}/view/${shareToken}`;
  }
  // Remove trailing slash from fallback
  const origin = fallbackOrigin.replace(/\/$/, '');
  return `${origin}/view/${shareToken}`;
}

/**
 * Build the public viewer URL for a document.
 * Uses the company's custom domain if verified, otherwise falls back to the app URL.
 *
 * @param shareToken - The document's share token
 * @param customDomain - The company's verified custom domain (e.g. "proposals.clientco.com"), or null
 * @param fallbackOrigin - Fallback origin (e.g. window.location.origin or NEXT_PUBLIC_APP_URL)
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
 * Build the public viewer URL for a creative review project.
 * Uses the company's custom domain if verified, otherwise falls back to the app URL.
 *
 * @param shareToken - The review project's share token
 * @param customDomain - The company's verified custom domain (e.g. "proposals.clientco.com"), or null
 * @param fallbackOrigin - Fallback origin (e.g. window.location.origin or NEXT_PUBLIC_APP_URL)
 */
export function buildReviewUrl(
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