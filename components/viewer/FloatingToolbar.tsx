// components/viewer/FloatingToolbar.tsx
'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Share2, Download, Printer, Loader2 } from 'lucide-react';

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
  accentColor = '#ff6700',
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
      try { await navigator.share({ title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) window.open(pdfUrl, '_blank');
  };

  if (numPages <= 1) return null;

  const btnStyle = {
    color: accentColor,
  };

  const btnHoverBg = `${accentColor}15`;

  return (
    <div
      className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-1 backdrop-blur-sm rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 border shadow-xl shadow-black/30"
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
        title="Share">
        <Share2 size={18} />
      </button>
      <button onClick={handleDownload} disabled={downloading}
        className="p-1.5 sm:p-2 transition-colors rounded-lg disabled:opacity-50"
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = btnHoverBg}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Download">
        {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
      </button>
      <button onClick={handlePrint}
        className="hidden sm:block p-1.5 sm:p-2 transition-colors rounded-lg"
        style={btnStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = btnHoverBg}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        title="Print">
        <Printer size={18} />
      </button>
    </div>
  );
}