'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, FileText as FileTextIcon, Film, Upload, X } from 'lucide-react';
import type { PendingAttachment } from './AttachmentPicker';

interface AttachFilesModalProps {
  onClose: () => void;
  onConfirm: (files: PendingAttachment[]) => void;
  /** Files already queued on the composer when modal opens */
  existing?: PendingAttachment[];
  maxFiles?: number;
  maxSizeMb?: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const SUPPORTED = 'JPG, JPEG, PNG, SVG, GIF, PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, ZIP';

/**
 * Matches markup.io's "Attach Files" modal: centred card, dashed drop-zone,
 * supported-format caption, Browse button. Returns selected files to the
 * composer for upload on submit — it doesn't upload here.
 */
export default function AttachFilesModal({
  onClose,
  onConfirm,
  existing = [],
  maxFiles = 5,
  maxSizeMb = 10,
}: AttachFilesModalProps) {
  const [files, setFiles] = useState<PendingAttachment[]>(existing);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      setError(null);
      const arr = Array.from(incoming);
      const remaining = maxFiles - files.length;
      if (remaining <= 0) {
        setError(`Maximum of ${maxFiles} files per comment.`);
        return;
      }
      const maxBytes = maxSizeMb * 1024 * 1024;
      const nextBatch: PendingAttachment[] = [];
      for (const file of arr.slice(0, remaining)) {
        if (file.size > maxBytes) {
          setError(`${file.name} exceeds the ${maxSizeMb}MB limit.`);
          continue;
        }
        const pa: PendingAttachment = { file };
        if (IMAGE_TYPES.includes(file.type)) {
          const reader = new FileReader();
          reader.onload = () => {
            pa.preview = reader.result as string;
            setFiles((prev) => [...prev]);
          };
          reader.readAsDataURL(file);
        }
        nextBatch.push(pa);
      }
      if (nextBatch.length > 0) {
        setFiles((prev) => [...prev, ...nextBatch]);
      }
    },
    [files.length, maxFiles, maxSizeMb]
  );

  const remove = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setError(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = () => {
    onConfirm(files);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-ink">Attach Files</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-faint hover:text-prose hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          <label
            htmlFor="attach-modal-input"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center w-full min-h-[200px] rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
              dragOver
                ? 'border-teal bg-teal/5'
                : 'border-gray-300 hover:border-gray-400 bg-surface/50'
            }`}
          >
            <div className="flex items-center gap-2 text-gray-300">
              <FileTextIcon size={44} strokeWidth={1.5} />
              <Film size={44} strokeWidth={1.5} />
              <FileImage size={44} strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-sm text-dim">
              Drag files here, or <span className="text-teal font-medium">browse</span>
            </p>
            <input
              id="attach-modal-input"
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          <p className="text-xs text-faint text-center">
            Supports: {SUPPORTED}
          </p>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="relative group w-16 h-16 rounded-lg border border-edge-strong overflow-hidden bg-surface flex items-center justify-center"
                >
                  {f.preview ? (
                    <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileTextIcon size={20} className="text-faint" />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-2xs text-white text-center truncate px-1 py-0.5">
                    {f.file.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-edge">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-dim hover:text-prose rounded-lg hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-hover transition-colors"
          >
            <Upload size={14} />
            Attach {files.length > 0 ? `(${files.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
