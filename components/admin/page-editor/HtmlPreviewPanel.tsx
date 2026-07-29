// components/admin/page-editor/HtmlPreviewPanel.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Code2, Upload, ClipboardPaste } from 'lucide-react';
import { UnifiedPage } from '@/lib/page-operations';

interface HtmlPreviewPanelProps {
  page: UnifiedPage;
  onUpdate: (pageId: string, changes: Record<string, unknown>) => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function HtmlPreviewPanel({
  page,
  onUpdate,
  onGoPrev,
  onGoNext,
  canGoPrev,
  canGoNext,
}: HtmlPreviewPanelProps) {
  const html = (page.payload?.html as string) || '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(html);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(() => {
    onUpdate(page.id, { payload_patch: { html: draft } });
    setEditing(false);
  }, [page.id, draft, onUpdate]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onUpdate(page.id, { payload_patch: { html: content } });
      setDraft(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [page.id, onUpdate]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onUpdate(page.id, { payload_patch: { html: text } });
        setDraft(text);
      }
    } catch {
      // Clipboard access denied — ignore
    }
  }, [page.id, onUpdate]);

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; }
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Nav header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <button
          onClick={onGoPrev}
          disabled={!canGoPrev}
          className="p-1 rounded hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-medium text-dim truncate px-2">
          {page.title || 'HTML Page'}
        </span>
        <button
          onClick={onGoNext}
          disabled={!canGoNext}
          className="p-1 rounded hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Content area */}
      {!html && !editing ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Code2 size={32} className="text-teal/30" />
          <p className="text-sm text-dim">No HTML content yet</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setDraft(''); setEditing(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-teal/30 hover:bg-teal/5 transition-colors"
            >
              <Code2 size={12} />
              Write HTML
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-teal/30 hover:bg-teal/5 transition-colors"
            >
              <Upload size={12} />
              Upload .html
            </button>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal border border-teal/30 hover:bg-teal/5 transition-colors"
            >
              <ClipboardPaste size={12} />
              Paste
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      ) : editing ? (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 min-h-0 w-full rounded-lg border border-edge p-3 text-xs font-mono text-prose bg-surface resize-none focus:outline-none focus:ring-1 focus:ring-teal/40"
            placeholder="Paste or write your HTML here..."
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-dim hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal hover:bg-teal/90 transition-colors"
            >
              Save HTML
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-edge">
            <button
              onClick={() => { setDraft(html); setEditing(true); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-teal hover:bg-teal/5 transition-colors"
            >
              <Code2 size={10} />
              Edit HTML
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-teal hover:bg-teal/5 transition-colors"
            >
              <Upload size={10} />
              Replace
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-auto p-3">
            <div className="rounded-lg border border-edge overflow-hidden bg-white" style={{ aspectRatio: '816 / 1056' }}>
              <iframe
                srcDoc={srcdoc}
                sandbox="allow-same-origin"
                className="w-full h-full border-0"
                style={{ background: 'transparent' }}
                title="HTML preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
