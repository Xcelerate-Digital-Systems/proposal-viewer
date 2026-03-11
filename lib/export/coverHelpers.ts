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
 * Returns a Map from 1-based page number → loaded PDFDocument.
 */
export async function loadPerPageDocs(
  pageUrls: PageUrlEntry[],
): Promise<Map<number, PDFDocument>> {
  const entries = await Promise.all(
    pageUrls
      .filter((entry) => entry.url !== null && entry.type === 'pdf')
      .map(async (entry) => {
        const bytes = await fetch(entry.url as string).then((r) => r.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        return [entry.position, doc] as [number, PDFDocument];
      }),
  );
  return new Map(entries);
}