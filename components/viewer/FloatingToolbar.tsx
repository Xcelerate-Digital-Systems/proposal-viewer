// components/viewer/FloatingToolbar.tsx
'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Share2, Download, Check, Loader2, X } from 'lucide-react';

interface FloatingToolbarProps {
  pdfUrl: string | null;
  title: string;
  currentPage: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  bgColor?: string;
  borderColor?: string;
  accentColor?: string;
  /** When provided, download builds a composite PDF (includes text/pricing pages) */
  onCompositeDownload?: () => Promise<Blob>;
}

export default function FloatingToolbar({
  pdfUrl,
  title,
  currentPage,
  numPages,
  onPrevPage,
  onNextPage,
  bgColor = '#1a1a1a',
  borderColor = '#2a2a2a',
  accentColor = '#01434A',
  onCompositeDownload,
}: FloatingToolbarProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [shared, setShared] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;

    setDownloadError(false);

    // Use composite download if available, otherwise fall back to raw PDF
    if (onCompositeDownload) {
      setDownloading(true);
      try {
        const blob = await onCompositeDownload();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch {
        setDownloadError(true);
        setTimeout(() => setDownloadError(false), 3000);
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'proposal'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 3000);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  if (numPages <= 1) return null;

  const btnStyle = {
    color: accentColor,
  };

  const btnHoverBg = `${accentColor}15`;

  return (
    <div
      className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-1 backdrop-blur-sm rounded-2xl px-1.5 sm:px-2 py-1 sm:py-1.5 border shadow-xl shadow-black/30"
      style={{ backgroundColor: `${bgColor}e6`, borderColor: accentColor }}
    >
      <button onClick={onPrevPage} disabled={currentPage === 1}
        className="p-2 sm:p-2.5 disabled:opacity-30 transition-colors rounded-lg"
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = btnHoverBg}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Previous page">
        <ChevronUp size={22} />
      </button>
      <button onClick={onNextPage} disabled={currentPage >= numPages}
        className="p-2 sm:p-2.5 disabled:opacity-30 transition-colors rounded-lg"
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = btnHoverBg}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Next page">
        <ChevronDown size={22} />
      </button>
      <div className="w-px h-5 mx-0.5" style={{ backgroundColor: `${accentColor}30` }} />
      <button onClick={handleShare}
        className="p-1.5 sm:p-2 transition-colors rounded-lg"
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = btnHoverBg}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title={shared ? 'Copied!' : 'Share'}>
        {shared ? <Check size={18} /> : <Share2 size={18} />}
      </button>
      <button onClick={handleDownload} disabled={downloading}
        className="p-1.5 sm:p-2 transition-colors rounded-lg disabled:opacity-50"
        style={downloadError ? { color: '#dc2626' } : btnStyle}
        onMouseEnter={(e) => { if (!downloadError) e.currentTarget.style.backgroundColor = btnHoverBg; }}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title={downloadError ? 'Download failed — try again' : 'Download'}>
        {downloading ? <Loader2 size={18} className="animate-spin" /> : downloadError ? <X size={18} /> : <Download size={18} />}
      </button>
    </div>
  );
}