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
  }).catch(() => {
    // Silently fail — notifications are non-critical
  });
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
    // Normalize page_names (handles both old string[] and new {name, indent}[] formats)
    setPageEntries(normalizePageNames(data.page_names, 100));
    if (data.status === 'accepted') setAccepted(true);

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

    // Notify team on first view
    if (isFirstView) {
      notify({ event_type: 'proposal_viewed', share_token: token });
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

    // Notify team of acceptance
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

    // Notify team of new comment
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

    // Notify team of reply (also a comment_added event)
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

    // Notify team of resolution
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
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  };
}