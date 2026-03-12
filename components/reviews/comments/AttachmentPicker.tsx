// components/reviews/comments/AttachmentPicker.tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';

export interface PendingAttachment {
  file: File;
  preview?: string; // data URL for images
}

interface AttachmentPickerProps {
  attachments: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function AttachmentPicker({
  attachments,
  onChange,
  maxFiles = 5,
  maxSizeMb = 10,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      setError(null);

      const remaining = maxFiles - attachments.length;
      if (remaining <= 0) {
        setError(`Max ${maxFiles} files`);
        return;
      }

      const newAttachments: PendingAttachment[] = [];
      const maxBytes = maxSizeMb * 1024 * 1024;

      for (let i = 0; i < Math.min(files.length, remaining); i++) {
        const file = files[i];
        if (file.size > maxBytes) {
          setError(`${file.name} exceeds ${maxSizeMb}MB limit`);
          continue;
        }

        const pa: PendingAttachment = { file };

        if (IMAGE_TYPES.includes(file.type)) {
          const reader = new FileReader();
          reader.onload = () => {
            pa.preview = reader.result as string;
            onChange([...attachments, ...newAttachments]);
          };
          reader.readAsDataURL(file);
        }

        newAttachments.push(pa);
      }

      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
      }

      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    },
    [attachments, onChange, maxFiles, maxSizeMb]
  );

  const remove = (index: number) => {
    const next = [...attachments];
    next.splice(index, 1);
    onChange(next);
    setError(null);
  };

  return (
    <div className="space-y-1.5">
      {/* Thumbnails */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="relative group w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center"
            >
              {a.preview ? (
                <img src={a.preview} alt={a.file.name} className="w-full h-full object-cover" />
              ) : IMAGE_TYPES.includes(a.file.type) ? (
                <ImageIcon size={16} className="text-gray-300" />
              ) : (
                <FileText size={16} className="text-gray-300" />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} />
              </button>
              <span className="absolute bottom-0 inset-x-0 bg-black/50 text-[7px] text-white text-center truncate px-0.5">
                {a.file.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {attachments.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Paperclip size={10} />
          Attach file
        </button>
      )}

      {error && (
        <p className="text-[10px] text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
