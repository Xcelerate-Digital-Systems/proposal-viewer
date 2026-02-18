'use client';

import { useState } from 'react';
import { ChevronUp, Share2, Download, Printer, Loader2 } from 'lucide-react';

interface FloatingToolbarProps {
  pdfUrl: string | null;
  title: string;
  currentPage: number;
  numPages: number;
  onPrevPage: () => void;
}

export default function FloatingToolbar({
  pdfUrl,
  title,
  currentPage,
  numPages,
  onPrevPage,
}: FloatingToolbarProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!pdfUrl || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'proposal'}.pdf`;
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

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) window.open(pdfUrl, '_blank');
  };

  if (numPages <= 1) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1a1a1a]/90 backdrop-blur-sm rounded-xl px-2 py-1.5 border border-[#2a2a2a] shadow-xl shadow-black/30">
      <button
        onClick={onPrevPage}
        disabled={currentPage === 1}
        className="p-2 text-[#888] hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-white/5"
        title="Previous page"
      >
        <ChevronUp size={18} />
      </button>
      <button
        onClick={handleShare}
        className="p-2 text-[#888] hover:text-white transition-colors rounded-lg hover:bg-white/5"
        title="Share"
      >
        <Share2 size={18} />
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-2 text-[#888] hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50"
        title="Download"
      >
        {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
      </button>
      <button
        onClick={handlePrint}
        className="p-2 text-[#888] hover:text-white transition-colors rounded-lg hover:bg-white/5"
        title="Print"
      >
        <Printer size={18} />
      </button>
    </div>
  );
}