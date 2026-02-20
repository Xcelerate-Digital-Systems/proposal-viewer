// hooks/useProposal.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, Proposal, ProposalComment, PageNameEntry, normalizePageNames } from '@/lib/supabase';

// Fire-and-forget notification — doesn't block UI
function notify(payload: Record<string, string | undefined>) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export type CompanyBranding = {
  name: string;
  logo_url: string | null;
  accent_color: string;
  website: string | null;
  bg_primary: string;
  bg_secondary: string;
  sidebar_text_color: string;
  accept_text_color: string;
  // Cover page branding
  cover_bg_style: 'gradient' | 'solid';
  cover_bg_color_1: string;
  cover_bg_color_2: string;
  cover_text_color: string;
  cover_subtitle_color: string;
  cover_button_bg: string;
  cover_button_text: string;
  cover_overlay_opacity: number;
  cover_gradient_type: 'linear' | 'radial' | 'conic';
  cover_gradient_angle: number;
};

const DEFAULT_BRANDING: CompanyBranding = {
  name: '',
  logo_url: null,
  accent_color: '#ff6700',
  website: null,
  bg_primary: '#0f0f0f',
  bg_secondary: '#141414',
  sidebar_text_color: '#ffffff',
  accept_text_color: '#ffffff',
  // Cover page defaults
  cover_bg_style: 'gradient',
  cover_bg_color_1: '#0f0f0f',
  cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff',
  cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700',
  cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65,
  cover_gradient_type: 'linear',
  cover_gradient_angle: 135,
};

/**
 * Derive a border color by lightening the secondary bg.
 * Adds ~16 to each RGB channel, clamped at 255.
 */
export function deriveBorderColor(bgSecondary: string): string {
  const hex = bgSecondary.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Derive a surface/card color between primary and secondary.
 * Used for elevated elements like cards and inputs.
 */
export function deriveSurfaceColor(bgPrimary: string, bgSecondary: string): string {
  const p = bgPrimary.replace('#', '');
  const s = bgSecondary.replace('#', '');
  const r = Math.round((parseInt(p.slice(0, 2), 16) + parseInt(s.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(p.slice(2, 4), 16) + parseInt(s.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(p.slice(4, 6), 16) + parseInt(s.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

export function useProposal(token: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageEntries, setPageEntries] = useState<PageNameEntry[]>([]);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  const fetchProposal = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProposal(data);
    setPageEntries(normalizePageNames(data.page_names, 100));
    if (data.status === 'accepted') setAccepted(true);

    // Fetch company branding
    try {
      const brandingRes = await fetch(`/api/company/branding?company_id=${data.company_id}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding(brandingData);
      }
    } catch {
      // Non-critical — fall back to defaults
    }
    // Check if the viewer is a logged-in user (i.e. a team member previewing).
    // Clients never have auth sessions — they view via share token only.
    let isTeamPreview = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        isTeamPreview = true;
      }
    } catch {
      // No session — treat as client view
    }

    // Only track views and fire notifications for actual client views
    if (!isTeamPreview) {
      const isFirstView = !data.first_viewed_at;

      const now = new Date().toISOString();
      const updates: Record<string, string> = { last_viewed_at: now };
      if (isFirstView) updates.first_viewed_at = now;
      if (data.status === 'sent' || data.status === 'draft') updates.status = 'viewed';

      await supabase.from('proposals').update(updates).eq('id', data.id);
      await supabase.from('proposal_views').insert({
        proposal_id: data.id,
        user_agent: navigator.userAgent,
        company_id: data.company_id,
      });

      if (isFirstView) {
        notify({ event_type: 'proposal_viewed', share_token: token });
      }
    }

    const { data: signedData } = await supabase.storage
      .from('proposals')
      .createSignedUrl(data.file_path, 3600);

    if (signedData?.signedUrl) setPdfUrl(signedData.signedUrl);

    const { data: commentsData } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', data.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    setComments(commentsData || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageEntries((prev) => {
      const entries = [...prev];
      while (entries.length < n) entries.push({ name: `Page ${entries.length + 1}`, indent: 0 });
      return entries.slice(0, n);
    });
  };

  const getPageName = (pageNum: number) => {
    return pageEntries[pageNum - 1]?.name || `Page ${pageNum}`;
  };

  const refreshComments = async () => {
    if (!proposal) return;
    const { data } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', proposal.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const acceptProposal = async (name: string) => {
    if (!proposal) return;
    await supabase.from('proposals').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name: name,
    }).eq('id', proposal.id);
    setAccepted(true);
    notify({ event_type: 'proposal_accepted', share_token: token });
  };

  const submitComment = async (authorName: string, content: string, pageNumber: number) => {
    if (!proposal) return;
    const { data: newComment } = await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: authorName,
      content,
      page_number: pageNumber,
      is_internal: false,
      company_id: proposal.company_id,
    }).select('id').single();

    await refreshComments();
    notify({
      event_type: 'comment_added',
      share_token: token,
      comment_id: newComment?.id,
      comment_author: authorName,
      comment_content: content,
    });
  };

  const replyToComment = async (parentId: string, authorName: string, content: string) => {
    if (!proposal) return;
    const parent = comments.find((c) => c.id === parentId);
    const { data: newReply } = await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: authorName,
      content,
      page_number: parent?.page_number || null,
      is_internal: false,
      parent_id: parentId,
      company_id: proposal.company_id,
    }).select('id').single();

    await refreshComments();
    notify({
      event_type: 'comment_added',
      share_token: token,
      comment_id: newReply?.id,
      comment_author: authorName,
      comment_content: content,
    });
  };

  const resolveComment = async (commentId: string, resolvedBy: string) => {
    await supabase
      .from('proposal_comments')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', commentId);
    await refreshComments();
    notify({
      event_type: 'comment_resolved',
      share_token: token,
      comment_id: commentId,
      resolved_by: resolvedBy,
    });
  };

  const unresolveComment = async (commentId: string) => {
    await supabase
      .from('proposal_comments')
      .update({
        resolved_at: null,
        resolved_by: null,
      })
      .eq('id', commentId);
    await refreshComments();
  };

  return {
    proposal,
    pdfUrl,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    notFound,
    pageEntries,
    comments,
    accepted,
    branding,
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  };
}