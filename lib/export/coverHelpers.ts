// lib/export/coverHelpers.ts

import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import type { Proposal } from '@/lib/supabase';
import type { PageUrlEntry } from '@/hooks/useProposal';

/**
 * Create a short-lived signed URL for a private storage path.
 */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

export interface CoverData {
  bgUrl: string | null;
  clientLogoUrl: string | null;
  avatarUrl: string | null;
  preparedByName: string | null;
}

/**
 * Resolve all signed URLs and metadata needed to render the cover page.
 */
export async function resolveCoverData(proposal: Proposal): Promise<CoverData> {
  let bgUrl: string | null = null;
  let clientLogoUrl: string | null = null;
  let avatarUrl: string | null = null;
  let preparedByName: string | null = proposal.prepared_by || null;

  if (proposal.cover_image_path) {
    bgUrl = await getSignedUrl('proposals', proposal.cover_image_path);
  }

  if (proposal.cover_client_logo_path && (proposal.cover_show_client_logo ?? false)) {
    clientLogoUrl = await getSignedUrl('proposals', proposal.cover_client_logo_path);
  }

  if (proposal.cover_avatar_path && (proposal.cover_show_avatar ?? false)) {
    avatarUrl = await getSignedUrl('proposals', proposal.cover_avatar_path);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberId = (proposal as any).prepared_by_member_id;
  if (memberId) {
    const needsName = !proposal.prepared_by;
    const needsAvatar = !proposal.cover_avatar_path && (proposal.cover_show_avatar ?? false);

    if (needsName || needsAvatar) {
      try {
        const { data } = await supabase
          .from('team_members')
          .select('name, avatar_path')
          .eq('id', memberId)
          .single();

        if (data) {
          if (needsName && data.name) {
            preparedByName = data.name;
          }
          if (needsAvatar && data.avatar_path) {
            avatarUrl = await getSignedUrl('proposals', data.avatar_path);
          }
        }
      } catch {
        // Member not found — continue without
      }
    }
  }

  return { bgUrl, clientLogoUrl, avatarUrl, preparedByName };
}

/**
 * Load all per-page PDFs in parallel.
 * Keys by sequential 1-based index to match toPdfPage() output —
 * NOT entry.position, which is the virtual page position and may be offset
 * by non-PDF pages (TOC, text pages, etc.).
 */
export async function loadPerPageDocs(
  pageUrls: PageUrlEntry[],
): Promise<Map<number, PDFDocument>> {
  const pdfEntries = pageUrls.filter((e) => e.url !== null && e.type === 'pdf');

  const entries = await Promise.all(
    pdfEntries.map(async (entry, index) => {
      const bytes = await fetch(entry.url as string).then((r) => r.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      return [index + 1, doc] as [number, PDFDocument];
    }),
  );
  return new Map(entries);
}

/**
 * Pre-fetch member badge data (name + avatar data URL) for all text pages
 * that have show_member_badge enabled.
 *
 * MemberBadge uses useEffect+fetch internally, which won't resolve before
 * html2canvas fires. Pre-fetching here and passing static data as a prop
 * lets the badge render synchronously at capture time.
 */
export async function prefetchMemberBadgeData(
  textPageIds: string[],
  getTextPage: (id: string) => { show_member_badge?: boolean; prepared_by_member_id?: string | null } | undefined,
): Promise<Record<string, { name: string; avatar_url: string | null }>> {
  const memberIds = new Set<string>();

  for (const id of textPageIds) {
    const page = getTextPage(id);
    if (page?.show_member_badge && page.prepared_by_member_id) {
      memberIds.add(page.prepared_by_member_id);
    }
  }

  if (memberIds.size === 0) return {};

  const results = await Promise.all(
    Array.from(memberIds).map(async (memberId) => {
      try {
        const res = await fetch(`/api/member-badge?member_id=${memberId}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.name) return null;
        return [memberId, { name: data.name as string, avatar_url: (data.avatar_url as string | null) ?? null }] as const;
      } catch {
        return null;
      }
    }),
  );

  const map: Record<string, { name: string; avatar_url: string | null }> = {};
  for (const entry of results) {
    if (entry) map[entry[0]] = entry[1];
  }
  return map;
}