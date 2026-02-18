'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageEditorProps {
  proposalId: string;
  filePath: string;
  initialPageNames: string[];
  onSave: () => void;
  onCancel: () => void;
}

export default function PageEditor({ proposalId, filePath, initialPageNames, onSave, onCancel }: PageEditorProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageNames, setPageNames] = useState<string[]>(initialPageNames);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const loadPdf = async () => {
      const { data } = await supabase.storage.from('proposals').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) setPdfUrl(data.signedUrl);
    };
    loadPdf();
  }, [filePath]);

  const onDocLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPageCount(numPages);
    setPageNames((prev) => {
      const names = [...prev];
      while (names.length < numPages) names.push(`Page ${names.length + 1}`);
      return names.slice(0, numPages);
    });
  };

  const handleSave = async () => {
    await supabase.from('proposals').update({ page_names: pageNames }).eq('id', proposalId);
    onSave();
  };

  return (
    <div className="border-t border-[#2a2a2a] bg-[#151515] p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-white">Edit Page Names</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#ff6700] text-white hover:bg-[#e85d00] transition-colors"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={onCancel}
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
  );
}