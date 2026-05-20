// hooks/useProposalDerived.ts
import { useCallback, useMemo } from 'react';
import { Proposal, parseTocSettings, PageNameEntry } from '@/lib/supabase';
import type { PageUrlEntry, ProposalTextPage } from './useProposal';

export function useProposalDerived(
  rawPageUrls: PageUrlEntry[],
  proposal: Proposal | null,
) {
  // Append a synthetic Decision page at the end for proposals. Lives only in
  // memory — never written to the page-store table — so existing rows keep
  // working without a backfill. Quotes already render the decision form inline
  // at the bottom of the quote, so we skip them. Documents have no
  // accept/decline flow at all.
  const pageUrls = useMemo<PageUrlEntry[]>(() => {
    if (proposal?.entity_type !== 'proposal') return rawPageUrls;
    // decision_page_enabled null = treat as true (default-on for legacy rows).
    if (proposal.decision_page_enabled === false) return rawPageUrls;
    if (rawPageUrls.length === 0) return rawPageUrls;
    const tail = rawPageUrls[rawPageUrls.length - 1];
    return [
      ...rawPageUrls,
      {
        id: '__decision__',
        position: tail.position + 1,
        type: 'decision',
        url: null,
        title: proposal.decision_page_title || 'Decision',
        indent: 0,
        show_title: true,
        show_member_badge: false,
        show_client_logo: false,
        prepared_by_member_id: null,
        payload: {},
      },
    ];
  }, [rawPageUrls, proposal?.entity_type, proposal?.decision_page_enabled, proposal?.decision_page_title]);

  // Sidebar nav entries — section pages become 'group' type.
  const pageEntries: PageNameEntry[] = useMemo(
    () =>
      pageUrls
        .map((p) => ({
          name: p.title,
          indent: p.indent,
          ...(p.type === 'section' ? { type: 'group' as const } : {}),
          ...(p.link_url ? { link_url: p.link_url } : {}),
          ...(p.link_label ? { link_label: p.link_label } : {}),
        })),
    [pageUrls],
  );

  const numPages = useMemo(
    () => pageUrls.filter((p) => p.type !== 'section').length,
    [pageUrls],
  );

  // Virtual page type helpers
  const isPricingPage  = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'pricing',  [pageUrls]);
  const isPackagesPage = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'packages', [pageUrls]);
  const isTocPage      = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'toc',      [pageUrls]);
  const isTextPage     = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'text',     [pageUrls]);
  const isDecisionPage = useCallback((vp: number) => pageUrls[vp - 1]?.type === 'decision', [pageUrls]);

  const getPackagesId = useCallback(
    (vp: number): string | null => pageUrls[vp - 1]?.type === 'packages' ? pageUrls[vp - 1].id : null,
    [pageUrls],
  );
  const getTextPageId = useCallback(
    (vp: number): string | null => pageUrls[vp - 1]?.type === 'text' ? pageUrls[vp - 1].id : null,
    [pageUrls],
  );
  const toPdfPage = useCallback(
    (vp: number): number => {
      let pdfCount = 0;
      for (let i = 0; i < vp - 1 && i < pageUrls.length; i++) {
        if (pageUrls[i].type === 'pdf') pdfCount++;
      }
      return pageUrls[vp - 1]?.type === 'pdf' ? pdfCount + 1 : -1;
    },
    [pageUrls],
  );

  // Virtual page sequence (for viewer components that expect it)
  const pageSequence = useMemo(
    () =>
      pageUrls.map((p) => {
        if (p.type === 'pdf') {
          const pdfIndex = pageUrls.slice(0, pageUrls.indexOf(p) + 1).filter((x) => x.type === 'pdf').length;
          return { type: 'pdf' as const, pdfPage: pdfIndex };
        }
        if (p.type === 'text') return { type: 'text' as const, textPageId: p.id };
        if (p.type === 'pricing') return { type: 'pricing' as const, pricingId: p.id };
        if (p.type === 'packages') return { type: 'packages' as const, packagesId: p.id };
        if (p.type === 'toc') return { type: 'toc' as const };
        if (p.type === 'decision') return { type: 'decision' as const };
        return { type: 'pdf' as const, pdfPage: 0 }; // section — shouldn't reach viewer
      }),
    [pageUrls],
  );

  const getPricingId = useCallback(
    (vp: number): string | null => pageUrls[vp - 1]?.type === 'pricing' ? pageUrls[vp - 1].id : null,
    [pageUrls],
  );

  // Extract all pricing/packages/textPages from payloads
  const pricingPages = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'pricing')
        .map((p) => ({ id: p.id, enabled: true, title: p.title, position: p.position, indent: p.indent, ...p.payload } as Record<string, unknown>)),
    [pageUrls],
  );

  // Backward-compat: first pricing page
  const pricing = pricingPages[0] ?? null;

  const packages = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'packages')
        .map((p) => {
          const merged = { id: p.id, enabled: true, title: p.title, indent: p.indent, ...p.payload };
          // Entity-level styling (post-2026-05 migration) overrides any stale
          // per-page styling that lingers in payload.
          if (proposal?.package_styling) {
            (merged as Record<string, unknown>).styling = proposal.package_styling;
          }
          return merged;
        }),
    [pageUrls, proposal],
  );

  const textPages: ProposalTextPage[] = useMemo(
    () =>
      pageUrls
        .filter((x) => x.type === 'text')
        .map((p) => ({
          id: p.id,
          proposal_id: proposal?.id ?? '',
          company_id: proposal?.company_id ?? '',
          enabled: true,
          position: p.position,
          title: p.title,
          content: p.payload.content ?? null,
          sort_order: p.position,
          indent: p.indent,
          link_url: p.link_url ?? null,
          link_label: p.link_label ?? null,
          show_title: p.show_title ?? true,
          show_member_badge: p.show_member_badge ?? false,
          show_client_logo: p.show_client_logo ?? false,
          prepared_by_member_id: p.prepared_by_member_id ?? null,
        })),
    [pageUrls, proposal],
  );

  const tocSettings = proposal ? parseTocSettings(proposal.toc_settings) : null;

  const pdfPageCount = useMemo(() => pageUrls.filter((p) => p.type === 'pdf').length, [pageUrls]);

  const getPageName = (pageNum: number) => pageEntries[pageNum - 1]?.name || `Page ${pageNum}`;

  const getTextPage = useCallback(
    (textPageId: string): ProposalTextPage | undefined => textPages.find((tp) => tp.id === textPageId),
    [textPages],
  );

  const onDocumentLoadSuccess = useCallback((_: { numPages: number }) => {
    // No-op in v2: page count comes from pageUrls.length, not PDF metadata
  }, []);

  return {
    pageEntries,
    numPages,
    // Augmented pageUrls (includes synthetic decision entry) — overrides the
    // raw state value when spread into useProposal's return.
    pageUrls,
    isPricingPage,
    isPackagesPage,
    isTocPage,
    isTextPage,
    isDecisionPage,
    getPricingId,
    getPackagesId,
    getTextPageId,
    toPdfPage,
    pageSequence,
    pricing,
    pricingPages,
    packages,
    textPages,
    tocSettings,
    pdfPageCount,
    getPageName,
    getTextPage,
    onDocumentLoadSuccess,
  };
}
