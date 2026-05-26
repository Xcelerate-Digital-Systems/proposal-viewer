'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';

interface Props {
  /** Canvas container element ref — the wrapper around .react-flow. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Filename stem (typically the review project name). */
  boardName: string;
}

/**
 * Export the current feedback whiteboard as PNG or PDF via html2canvas +
 * pdf-lib. Calls fitView before capture so the export frames the whole
 * board, not the user's current pan/zoom. Controls / MiniMap / panels /
 * side drawer are skipped via the ignoreElements predicate.
 */
export default function ExportMenu({ containerRef, boardName }: Props) {
  const rf = useReactFlow();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const safeFilename = (ext: string) =>
    `${(boardName || 'whiteboard').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'whiteboard'}.${ext}`;

  const captureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const root = containerRef.current;
    if (!root) return null;
    rf.fitView({ padding: 0.15, duration: 0 });
    await new Promise((r) => setTimeout(r, 80));

    const flow = root.querySelector('.react-flow') as HTMLElement | null;
    if (!flow) return null;

    const canvas = await html2canvas(flow, {
      backgroundColor: '#FFFDF7',
      scale: window.devicePixelRatio >= 2 ? 2 : 1.5,
      logging: false,
      useCORS: true,
      ignoreElements: (el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.classList.contains('react-flow__controls')) return true;
        if (el.classList.contains('react-flow__minimap')) return true;
        if (el.classList.contains('react-flow__panel')) return true;
        if (el.tagName === 'ASIDE') return true;
        return false;
      },
    });
    return canvas;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (busy) return;
    setBusy('png');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, safeFilename('png'));
      }, 'image/png', 0.95);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const exportPdf = async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const pngBytes = await (await fetch(dataUrl)).arrayBuffer();

      const pdf = await PDFDocument.create();
      const img = await pdf.embedPng(pngBytes);
      const aspect = img.width / img.height;
      const pageH = 612;
      const pageW = Math.min(1800, Math.round(pageH * aspect));
      const page = pdf.addPage([pageW, pageH]);
      page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
      const bytes = await pdf.save();
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([buf], { type: 'application/pdf' }), safeFilename('pdf'));
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!busy}
        className="flex items-center gap-1.5 bg-white border border-edge shadow-sm rounded-lg px-3 py-1.5 text-[12px] text-ink hover:bg-surface transition-colors disabled:opacity-60"
        title="Export whiteboard"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-44 bg-white border border-edge shadow-xl rounded-lg py-1 z-30">
          <button
            type="button"
            onClick={exportPng}
            disabled={!!busy}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            <FileImage size={13} className="text-muted" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={!!busy}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            <FileText size={13} className="text-muted" />
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}
