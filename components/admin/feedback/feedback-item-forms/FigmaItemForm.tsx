'use client';

import { useState, useCallback } from 'react';
import { Loader2, ArrowLeft, Check, ExternalLink, Figma, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { authFetch } from '@/lib/auth-fetch';
import type { CreatedItemSummary } from './useFeedbackItemSubmit';

interface FigmaPage {
  id: string;
  name: string;
  frames: FigmaFrame[];
}

interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

interface FigmaItemFormProps {
  reviewProjectId: string;
  companyId: string;
  onBack: () => void;
  onCancel: () => void;
  onSuccess: (created?: CreatedItemSummary) => void;
}

type Step = 'url' | 'pick' | 'importing';

export default function FigmaItemForm({
  reviewProjectId,
  companyId,
  onBack,
  onCancel,
  onSuccess,
}: FigmaItemFormProps) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File data from Figma API
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [pages, setPages] = useState<FigmaPage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchFile = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(`/api/connectors/figma/files?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch Figma file');
        setLoading(false);
        return;
      }

      setFileKey(data.data.fileKey);
      setFileName(data.data.name);
      setPages(data.data.pages);
      setStep('pick');
    } catch {
      setError('Failed to connect to Figma');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const toggleFrame = (frameId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) next.delete(frameId);
      else next.add(frameId);
      return next;
    });
  };

  const selectAll = () => {
    const all = pages.flatMap((p) => p.frames.map((f) => f.id));
    setSelected(new Set(all));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const importFrames = useCallback(async () => {
    if (selected.size === 0) return;
    setStep('importing');
    setLoading(true);

    const frames = pages
      .flatMap((p) => p.frames)
      .filter((f) => selected.has(f.id))
      .map((f) => ({ nodeId: f.id, name: f.name }));

    try {
      const res = await authFetch('/api/connectors/figma/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewProjectId,
          fileKey,
          fileName,
          frames,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to import frames');
        setStep('pick');
        setLoading(false);
        return;
      }

      const count = data.data.total;
      toast.success(`${count} Figma frame${count !== 1 ? 's' : ''} imported`);
      onSuccess();
      onCancel();
    } catch {
      toast.error('Failed to import frames');
      setStep('pick');
      setLoading(false);
    }
  }, [selected, pages, reviewProjectId, fileKey, fileName, toast, onSuccess, onCancel]);

  const totalFrames = pages.reduce((sum, p) => sum + p.frames.length, 0);

  // Step 1: Enter Figma URL
  if (step === 'url') {
    return (
      <>
        <Modal.Body className="space-y-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-faint hover:text-teal transition-colors"
          >
            <ArrowLeft size={13} />
            Back
          </button>

          <div>
            <label className="block text-caption font-medium text-ink mb-1.5">
              Figma File URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://www.figma.com/design/abc123/..."
              className="w-full px-3 py-2.5 bg-surface rounded-2xl text-caption focus:outline-none focus:ring-2 focus:ring-teal/30"
              onKeyDown={(e) => { if (e.key === 'Enter') fetchFile(); }}
              autoFocus
            />
            <p className="text-detail text-faint mt-1.5">
              Paste any Figma file URL. You&apos;ll choose which frames to import next.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p className="text-caption">{error}</p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            onClick={fetchFile}
            disabled={!url.trim() || loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Figma size={14} className="mr-1.5" />}
            Fetch Frames
          </Button>
        </Modal.Footer>
      </>
    );
  }

  // Step 2: Pick frames
  if (step === 'pick') {
    return (
      <>
        <Modal.Body className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('url')}
              className="inline-flex items-center gap-1 text-xs font-medium text-faint hover:text-teal transition-colors"
            >
              <ArrowLeft size={13} />
              Change URL
            </button>
            <div className="flex items-center gap-3">
              <span className="text-detail text-faint">
                {selected.size} of {totalFrames} selected
              </span>
              <button
                onClick={selected.size === totalFrames ? deselectAll : selectAll}
                className="text-xs font-medium text-teal hover:text-teal/80 transition-colors"
              >
                {selected.size === totalFrames ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-caption text-ink">
            <Figma size={16} className="text-[#a259ff]" />
            <span className="font-medium">{fileName}</span>
            <a
              href={`https://www.figma.com/design/${fileKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-faint hover:text-teal transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-4">
            {pages.map((page) => (
              <div key={page.id}>
                <p className="text-detail font-medium text-dim mb-2 uppercase tracking-wider">
                  {page.name}
                </p>
                {page.frames.length === 0 ? (
                  <p className="text-detail text-faint italic">No frames on this page</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {page.frames.map((frame) => {
                      const isSelected = selected.has(frame.id);
                      return (
                        <button
                          key={frame.id}
                          onClick={() => toggleFrame(frame.id)}
                          className={`relative rounded-xl border-2 overflow-hidden transition-all text-left ${
                            isSelected
                              ? 'border-teal bg-teal/5'
                              : 'border-edge hover:border-teal/40'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-surface-inset flex items-center justify-center overflow-hidden">
                            {frame.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={frame.thumbnailUrl}
                                alt={frame.name}
                                className="w-full h-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <Figma size={20} className="text-faint" />
                            )}
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-2xs font-medium text-ink truncate">{frame.name}</p>
                            <p className="text-2xs text-faint">{frame.width} × {frame.height}</p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            onClick={importFrames}
            disabled={selected.size === 0}
          >
            Import {selected.size} Frame{selected.size !== 1 ? 's' : ''}
          </Button>
        </Modal.Footer>
      </>
    );
  }

  // Step 3: Importing
  return (
    <Modal.Body>
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 size={32} className="animate-spin text-teal" />
        <p className="text-caption font-medium text-ink">
          Importing {selected.size} frame{selected.size !== 1 ? 's' : ''} from Figma...
        </p>
        <p className="text-detail text-faint">
          Rendering high-resolution images. This may take a moment.
        </p>
      </div>
    </Modal.Body>
  );
}
