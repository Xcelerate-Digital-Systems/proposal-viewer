'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase, Proposal } from '@/lib/supabase';
import {
  Upload, Link2, Eye, CheckCircle2, Clock, FileText, Copy, Check,
  Trash2, Plus, X, Pencil, Save, ChevronDown, ChevronUp
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AdminDashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [editingPages, setEditingPages] = useState<string | null>(null);
  const [pageNames, setPageNames] = useState<string[]>([]);
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
    setProposals(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    try {
      const filePath = `${Date.now()}-${file.name}`;
      setUploadProgress(0);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/proposals/${filePath}`);
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });

      const { error: dbError } = await supabase.from('proposals').insert({
        title: form.title,
        client_name: form.client_name,
        client_email: form.client_email || null,
        description: form.description || null,
        file_path: filePath,
        file_size_bytes: file.size,
        status: 'draft',
        page_names: [],
      });

      if (dbError) throw dbError;

      setForm({ title: '', client_name: '', client_email: '', description: '' });
      setFile(null);
      setShowUpload(false);
      fetchProposals();
    } catch (err) {
      console.error(err);
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markAsSent = async (id: string) => {
    await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    fetchProposals();
  };

  const deleteProposal = async (id: string, filePath: string) => {
    if (!confirm('Delete this proposal? This cannot be undone.')) return;
    await supabase.storage.from('proposals').remove([filePath]);
    await supabase.from('proposals').delete().eq('id', id);
    fetchProposals();
  };

  const startEditingPages = async (proposal: Proposal) => {
    setEditingPages(proposal.id);
    setExpandedId(proposal.id);

    const { data: signedData } = await supabase.storage
      .from('proposals')
      .createSignedUrl(proposal.file_path, 3600);

    if (signedData?.signedUrl) {
      setPdfUrl(signedData.signedUrl);
    }

    const existing = proposal.page_names || [];
    setPageNames(existing);
  };

  const onDocLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPdfPageCount(numPages);
    setPageNames((prev) => {
      const names = [...prev];
      while (names.length < numPages) {
        names.push(`Page ${names.length + 1}`);
      }
      return names.slice(0, numPages);
    });
  };

  const savePageNames = async (proposalId: string) => {
    await supabase.from('proposals').update({ page_names: pageNames }).eq('id', proposalId);
    setEditingPages(null);
    setPdfUrl(null);
    fetchProposals();
  };

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    draft: { icon: <FileText size={14} />, color: 'bg-[#1a1a1a] text-[#999]', label: 'Draft' },
    sent: { icon: <Clock size={14} />, color: 'bg-blue-900/30 text-blue-400', label: 'Sent' },
    viewed: { icon: <Eye size={14} />, color: 'bg-amber-900/30 text-amber-400', label: 'Viewed' },
    accepted: { icon: <CheckCircle2 size={14} />, color: 'bg-emerald-900/30 text-emerald-400', label: 'Accepted' },
    declined: { icon: <X size={14} />, color: 'bg-red-900/30 text-red-400', label: 'Declined' },
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '\u2014';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '\u2014';
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#2a2a2a] bg-[#0f0f0f]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
           <img src="/logo-white.svg" alt="Xcelerate Digital Systems" className="h-8" />
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-[#ff6700] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors"
          >
            <Plus size={16} />
            New Proposal
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {showUpload && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-lg border border-[#2a2a2a]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
                <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-white">New Proposal</h2>
                <button onClick={() => setShowUpload(false)} className="text-[#666] hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpload} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#999] mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Website Redesign Proposal"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#999] mb-1">Client Name</label>
                    <input
                      type="text"
                      required
                      value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      placeholder="John Smith"
                      className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#999] mb-1">Client Email</label>
                    <input
                      type="email"
                      value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 placeholder:text-[#555]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#999] mb-1">Description (optional)</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Brief note about this proposal..."
                    className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6700]/30 focus:border-[#ff6700]/50 resize-none placeholder:text-[#555]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#999] mb-1">PDF File</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#2a2a2a] rounded-xl cursor-pointer hover:border-[#ff6700]/40 hover:bg-[#ff6700]/5 transition-colors">
                    {file ? (
                      <div className="flex items-center gap-2 text-sm text-[#999]">
                        <FileText size={20} className="text-[#ff6700]" />
                        <span className="font-medium text-white">{file.name}</span>
                        <span className="text-[#666]">({formatSize(file.size)})</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-[#444]" />
                        <span className="text-sm text-[#666]">Click to upload PDF</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                {uploading && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#999]">Uploading...</span>
                      <span className="text-[#ff6700] font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ff6700] rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full bg-[#ff6700] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#e85d00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Creating proposal...' : 'Create Proposal'}
                </button>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#333] border-t-[#ff6700] rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-[#444]" />
            </div>
            <h3 className="text-lg font-semibold text-[#999] mb-1">No proposals yet</h3>
            <p className="text-sm text-[#666]">Upload your first proposal to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const sc = statusConfig[p.status];
              return (
                <div key={p.id} className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden hover:border-[#333] transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold font-[family-name:var(--font-display)] truncate text-white">{p.title}</h3>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[#666]">
                          <span>{p.client_name}</span>
                          <span className="text-[#333]">&middot;</span>
                          <span>{formatSize(p.file_size_bytes)}</span>
                          <span className="text-[#333]">&middot;</span>
                          <span>{formatDate(p.created_at)}</span>
                          {p.accepted_at && (
                            <>
                              <span className="text-[#333]">&middot;</span>
                              <span className="text-emerald-400 font-medium">
                                Accepted {formatDate(p.accepted_at)}
                                {p.accepted_by_name && ` by ${p.accepted_by_name}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyLink(p.share_token)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                        >
                          {copiedId === p.share_token ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          {copiedId === p.share_token ? 'Copied!' : 'Copy Link'}
                        </button>
                        {p.status === 'draft' && (
                          <button
                            onClick={() => markAsSent(p.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 transition-colors"
                          >
                            <Link2 size={14} />
                            Mark Sent
                          </button>
                        )}
                        <button
                          onClick={() => startEditingPages(p)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                        >
                          <Pencil size={14} />
                          Edit Pages
                        </button>
                        <a
                          href={`/view/${p.share_token}`}
                          target="_blank"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
                        >
                          <Eye size={14} />
                          Preview
                        </a>
                        <button
                          onClick={() => deleteProposal(p.id, p.file_path)}
                          className="p-2 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingPages === p.id && (
                    <div className="border-t border-[#2a2a2a] bg-[#151515] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-white">Edit Page Names</h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => savePageNames(p.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
                          >
                            <Save size={14} />
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingPages(null); setPdfUrl(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#222] text-[#999] hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {pdfUrl && (
                        <div className="hidden">
                          <Document file={pdfUrl} onLoadSuccess={onDocLoadSuccess}>
                            <Page pageNumber={1} width={1} />
                          </Document>
                        </div>
                      )}
                      <p className="text-xs text-[#666] mb-3">
                        These names appear as tabs in the client viewer instead of &quot;Page 1, Page 2...&quot;
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {pageNames.map((name, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-[#555] w-6 text-right shrink-0">{i + 1}.</span>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => {
                                const updated = [...pageNames];
                                updated[i] = e.target.value;
                                setPageNames(updated);
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:border-[#ff6700]/50 placeholder:text-[#555]"
                            />
                          </div>
                        ))}
                        {pageNames.length === 0 && (
                          <p className="text-sm text-[#555] col-span-2">Loading pages...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
