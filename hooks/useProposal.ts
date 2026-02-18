'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, Proposal, ProposalComment } from '@/lib/supabase';

export function useProposal(token: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageNames, setPageNames] = useState<string[]>([]);
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
    setPageNames(data.page_names || []);
    if (data.status === 'accepted') setAccepted(true);

    const now = new Date().toISOString();
    const updates: Record<string, string> = { last_viewed_at: now };
    if (!data.first_viewed_at) updates.first_viewed_at = now;
    if (data.status === 'sent' || data.status === 'draft') updates.status = 'viewed';

    await supabase.from('proposals').update(updates).eq('id', data.id);
    await supabase.from('proposal_views').insert({
      proposal_id: data.id,
      user_agent: navigator.userAgent,
    });

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
    setPageNames((prev) => {
      const names = [...prev];
      while (names.length < n) names.push(`Page ${names.length + 1}`);
      return names.slice(0, n);
    });
  };

  const getPageName = (pageNum: number) => {
    return pageNames[pageNum - 1] || `Page ${pageNum}`;
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
  };

  const submitComment = async (authorName: string, content: string, pageNumber: number) => {
    if (!proposal) return;
    await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: authorName,
      content,
      page_number: pageNumber,
      is_internal: false,
    });
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
    pageNames,
    comments,
    accepted,
    onDocumentLoadSuccess,
    getPageName,
    acceptProposal,
    submitComment,
  };
}