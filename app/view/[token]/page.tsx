'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase, Proposal, ProposalComment } from '@/lib/supabase';
import {
  Download, MessageSquare, CheckCircle2, ChevronLeft, ChevronRight,
  X, Send, ZoomIn, ZoomOut, FileText, Loader2, PanelLeftClose, PanelLeft
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ProposalViewerPage({ params }: { params: { token: string } }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [pageNames, setPageNames] = useState<string[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showAccept, setShowAccept] = useState(false);
  const [acceptName, setAcceptName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);

  const fetchProposal = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('share_token', params.token)
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
  }, [params.token]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNames((prev) => {
      const names = [...prev];
      while (names.length < n) {
        names.push(`Page ${names.length + 1}`);
      }
      return names.slice(0, n);
    });
  };

  const getPageName = (pageNum: number) => {
    if (pageNames[pageNum - 1]) return pageNames[pageNum - 1];
    return `Page ${pageNum}`;
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownload = async () => {
    if (!pdfUrl || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposal?.title || 'proposal'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentName.trim() || !proposal) return;
    setSubmittingComment(true);

    await supabase.from('proposal_comments').insert({
      proposal_id: proposal.id,
      author_name: commentName,
      content: commentText,
      page_number: currentPage,
      is_internal: false,
    });

    const { data: fresh } = await supabase
      .from('proposal_comments')
      .select('*')
      .eq('proposal_id', proposal.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    setComments(fresh || []);
    setCommentText('');
    setSubmittingComment(false);
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptName.trim() || !proposal) return;
    setAccepting(true);

    await supabase.from('proposals').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name: acceptName,
    }).eq('id', proposal.id);

    setAccepted(true);
    setAccepting(false);
    setShowAccept(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#ff6700] animate-spin" />
          <p className="text-[#666] text-sm">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[#444]" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
          <p className="text-[#666] text-sm">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f] overflow-hidden">
      <header className="h-14 bg-[#0f0f0f] border-b border-[#2a2a2a] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6700] to-[#ff8533] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white font-[family-name:var(--font-display)] truncate max-w-[300px]">
              {proposal?.title}
            </h1>
            <p className="text-xs text-[#666]">Prepared for {proposal?.client_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 bg-[#1a1a1a] rounded-lg px-1 border border-[#2a2a2a]">
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.2))}
              className="p-1.5 text-[#666] hover:text-white transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-[#666] w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(Math.min(3, scale + 0.2))}
              className="p-1.5 text-[#666] hover:text-white transition-colors"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#999] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">{downloading ? 'Downloading...' : 'Download'}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              showComments
                ? 'bg-[#ff6700] border-[#ff6700] text-white'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#999] hover:text-white hover:border-[#444]'
            }`}
          >
            <MessageSquare size={15} />
            <span className="hidden sm:inline">Comments</span>
            {comments.length > 0 && (
              <span className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                showComments ? 'bg-white/20 text-white' : 'bg-[#ff6700] text-white'
              }`}>
                {comments.length}
              </span>
            )}
          </button>

          {accepted ? (
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
              <CheckCircle2 size={15} />
              Accepted
            </div>
          ) : (
            <button
              onClick={() => setShowAccept(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
            >
              <CheckCircle2 size={15} />
              Accept Proposal
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <div className="w-56 bg-[#141414] border-r border-[#2a2a2a] flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">Contents</p>
            </div>
            <div className="flex-1 overflow-y-auto tab-sidebar py-1">
              {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-l-2 ${
                    currentPage === pageNum
                      ? 'bg-[#ff6700]/10 border-[#ff6700] text-white'
                      : 'border-transparent text-[#777] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <span className={`text-xs font-mono w-5 text-center shrink-0 ${
                    currentPage === pageNum ? 'text-[#ff6700]' : 'text-[#555]'
                  }`}>
                    {pageNum}
                  </span>
                  <span className="text-sm font-medium truncate">{getPageName(pageNum)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-1/2 -translate-y-1/2 z-10 bg-[#1a1a1a] text-[#666] hover:text-white p-1.5 rounded-r-lg border border-l-0 border-[#2a2a2a] transition-colors"
          style={{ left: sidebarOpen ? '224px' : '0' }}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <div ref={mainRef} className="flex-1 overflow-auto flex justify-center p-6 bg-[#0f0f0f]">
          {pdfUrl ? (
            <div className="flex flex-col items-center gap-6">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center gap-3 text-[#666]">
                    <Loader2 className="animate-spin text-[#ff6700]" size={20} />
                    <span>Loading PDF...</span>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="shadow-2xl shadow-black/50 rounded-lg overflow-hidden"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {numPages > 1 && (
                <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl px-4 py-2.5 sticky bottom-4 border border-[#2a2a2a]">
                  <button
                    onClick={() => goToPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1 text-[#666] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-[#999] font-medium min-w-[140px] text-center">
                    {getPageName(currentPage)}
                  </span>
                  <button
                    onClick={() => goToPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage === numPages}
                    className="p-1 text-[#666] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-[#ff6700]" size={24} />
            </div>
          )}
        </div>

        {showComments && (
          <div className="w-80 bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-semibold text-white">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-[#666] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-[#555] text-center py-8">No comments yet</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{c.author_name}</span>
                      {c.page_number && (
                        <button
                          onClick={() => goToPage(c.page_number!)}
                          className="text-xs text-[#ff6700] hover:text-[#ff8533]"
                        >
                          {getPageName(c.page_number)}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#999]">{c.content}</p>
                    <span className="text-xs text-[#555] mt-1 block">
                      {new Date(c.created_at).toLocaleString('en-AU', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="p-4 border-t border-[#2a2a2a] space-y-2">
              <input
                type="text"
                placeholder="Your name"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim() || !commentName.trim()}
                  className="px-3 py-2 bg-[#ff6700] text-white rounded-lg hover:bg-[#e85d00] disabled:opacity-40 transition-colors"
                >
                  <Send size={15} />
                </button>
              </div>
              <p className="text-xs text-[#555]">Commenting on: {getPageName(currentPage)}</p>
            </form>
          </div>
        )}
      </div>

      {showAccept && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-md border border-[#2a2a2a]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-display)]">
                Accept Proposal
              </h2>
              <button onClick={() => setShowAccept(false)} className="text-[#666] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAccept} className="p-6">
              <p className="text-sm text-[#999] mb-4">
                By clicking accept, you acknowledge that you have reviewed the proposal
                &ldquo;<span className="text-white font-medium">{proposal?.title}</span>&rdquo;
                and agree to proceed with the next steps.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#999] mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={acceptName}
                  onChange={(e) => setAcceptName(e.target.value)}
                  placeholder="Enter your full name to accept"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
                />
              </div>
              <button
                type="submit"
                disabled={accepting || !acceptName.trim()}
                className="w-full bg-[#ff6700] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#e85d00] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {accepting ? 'Processing...' : 'I Accept — Proceed'}
              </button>
              <p className="text-xs text-[#555] mt-3 text-center">
                This action will be timestamped and recorded.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}