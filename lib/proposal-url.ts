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