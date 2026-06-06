'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { toCanvas } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';

interface Props {
  /** The canvas container element ref (the wrapper that owns .react-flow__viewport). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Funnel name — used for the downloaded filename. */
  funnelName: string;
}

/**
 * Export the current funnel canvas as PNG or PDF. We snapshot the
 * .react-flow element via html-to-image. Before capture we call fitView
 * so the export frames the whole funnel rather than the user's current
 * pan/zoom.
 */
export default function ExportMenu({ containerRef, funnelName }: Props) {
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
    `${(funnelName || 'funnel').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'funnel'}.${ext}`;

  const captureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const root = containerRef.current;
    if (!root) return null;
    const viewport = root.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return null;

    // Frame the whole funnel before capture so the user's pan/zoom doesn't
    // crop the output. 50ms tick lets RF settle the transform.
    rf.fitView({ padding: 0.15, duration: 0 });
    await new Promise((r) => setTimeout(r, 80));

    // Capture the inner flow container (.react-flow) — it holds the transform
    // wrapper plus edges. Capturing only .react-flow__viewport crops out the
    // outer pane background.
    const flow = root.querySelector('.react-flow') as HTMLElement | null;
    if (!flow) return null;

    const canvas = await toCanvas(flow, {
      backgroundColor: '#FFFDF7',
      cacheBust: true,
      pixelRatio: window.devicePixelRatio >= 2 ? 2 : 1.5,
      filter: (el) => {
        if (!(el instanceof HTMLElement)) return true;
        if (el.classList.contains('react-flow__controls')) return false;
        if (el.classList.contains('react-flow__minimap')) return false;
        if (el.classList.contains('react-flow__panel')) return false;
        if (el.tagName === 'ASIDE') return false;
        return true;
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
      // Landscape Letter-ish at 96 DPI; size the page to the image aspect.
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
        className="flex items-center gap-1.5 bg-white border border-edge shadow-sm rounded-lg px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors disabled:opacity-60"
        title="Export funnel"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-44 bg-white border border-edge shadow-xl rounded-lg py-1 z-50">
          <button
            type="button"
            onClick={exportPng}
            disabled={!!busy}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            <FileImage size={13} className="text-muted" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={!!busy}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            <FileText size={13} className="text-muted" />
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}
