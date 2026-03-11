// hooks/useProposalActions.ts
import { supabase, Proposal, ProposalComment } from '@/lib/supabase';

/** Fire-and-forget notification — doesn't block UI */
function notify(payload: Record<string, string | undefined>) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export interface ProposalActionsParams {
  proposal: Proposal | null;
  token: string;
  comments: ProposalComment[];
  isTeamPreview: boolean;
  setAccepted: (v: boolean) => void;
  setDeclined: (v: boolean) => void;
  setRevisionRequested: (v: boolean) => void;
  setComments: (c: ProposalComment[]) => void;
}

export function createProposalActions({
  proposal, token, comments, isTeamPreview,
  setAccepted, setDeclined, setRevisionRequested, setComments,
}: ProposalActionsParams) {
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
    await supabase
      .from('proposals')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_name: name })
      .eq('id', proposal.id);
    setAccepted(true);
    notify({ event_type: 'proposal_accepted', share_token: token });
  };

  const declineProposal = async (name: string, reason: string) => {
    if (!proposal) return;
    await supabase
      .from('proposals')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        declined_by_name: name,
        decline_reason: reason,
      })
      .eq('id', proposal.id);
    setDeclined(true);
    notify({
      event_type: 'proposal_declined',
      share_token: token,
      feedback_text: reason,
      feedback_by: name,
    });
  };

  const requestRevision = async (name: string, notes: string) => {
    if (!proposal) return;
    await supabase
      .from('proposals')
      .update({
        status: 'revision_requested',
        revision_requested_at: new Date().toISOString(),
        revision_requested_by_name: name,
        revision_notes: notes,
      })
      .eq('id', proposal.id);
    setRevisionRequested(true);
    notify({
      event_type: 'proposal_revision_requested',
      share_token: token,
      feedback_text: notes,
      feedback_by: name,
    });
  };

  const submitComment = async (authorName: string, content: string, pageNumber: number) => {
    if (!proposal) return;
    const authorType = isTeamPreview ? 'team' : 'client';
    const { data: newComment } = await supabase
      .from('proposal_comments')
      .insert({
        proposal_id: proposal.id,
        author_name: authorName,
        author_type: authorType,
        content,
        page_number: pageNumber,
        is_internal: false,
        company_id: proposal.company_id,
      })
      .select('id')
      .single();
    await refreshComments();
    notify({ event_type: 'comment_added', share_token: token, comment_id: newComment?.id, comment_author: authorName, comment_content: content, author_type: authorType });
  };

  const replyToComment = async (parentId: string, authorName: string, content: string) => {
    if (!proposal) return;
    const authorType = isTeamPreview ? 'team' : 'client';
    const parent = comments.find((c) => c.id === parentId);
    const { data: newReply } = await supabase
      .from('proposal_comments')
      .insert({
        proposal_id: proposal.id,
        author_name: authorName,
        author_type: authorType,
        content,
        page_number: parent?.page_number || null,
        is_internal: false,
        parent_id: parentId,
        company_id: proposal.company_id,
      })
      .select('id')
      .single();
    await refreshComments();
    notify({ event_type: 'comment_added', share_token: token, comment_id: newReply?.id, comment_author: authorName, comment_content: content, author_type: authorType });
  };

  const resolveComment = async (commentId: string, resolvedBy: string) => {
    const authorType = isTeamPreview ? 'team' : 'client';
    await supabase
      .from('proposal_comments')
      .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq('id', commentId);
    await refreshComments();
    notify({ event_type: 'comment_resolved', share_token: token, comment_id: commentId, resolved_by: resolvedBy, author_type: authorType });
  };

  const unresolveComment = async (commentId: string) => {
    await supabase
      .from('proposal_comments')
      .update({ resolved_at: null, resolved_by: null })
      .eq('id', commentId);
    await refreshComments();
  };

  return {
    acceptProposal,
    declineProposal,
    requestRevision,
    submitComment,
    replyToComment,
    resolveComment,
    unresolveComment,
  };
}
