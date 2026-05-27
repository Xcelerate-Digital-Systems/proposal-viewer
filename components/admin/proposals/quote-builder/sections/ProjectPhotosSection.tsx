// components/admin/proposals/quote-builder/sections/ProjectPhotosSection.tsx
// Two-slot project photo uploader. Photo 1 acts as the cover hero on the
// rendered quote (overrides cover_image_path); Photo 2 appears as a wide
// feature image right before the Scope of Works section. Limit is 2 to keep
// quotes tight — proof shots, not a full gallery.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Image as ImageIcon, X, Upload } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '../SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

const MAX_PHOTOS = 2;
const MAX_BYTES = 4 * 1024 * 1024;

function parsePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string').slice(0, MAX_PHOTOS);
}

export default function ProjectPhotosSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const [paths, setPaths] = useState<string[]>(() => parsePaths(proposal.project_photos));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputs = useRef<Array<HTMLInputElement | null>>([]);

  // Resolve signed URLs for any saved paths
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const path of paths) {
        const { data } = await supabase.storage
          .from('proposals')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) next[path] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const persist = async (next: string[]) => {
    const { error } = await supabase
      .from('proposals')
      .update({ project_photos: next })
      .eq('id', proposal.id);
    if (error) {
      toast.error('Failed to save photos');
      return false;
    }
    onSaved();
    return true;
  };

  const upload = async (slot: number, file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error('Photo must be 4 MB or smaller');
      return;
    }
    setUploadingSlot(slot);
    try {
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = sanitized.split('.').pop() || 'jpg';
      const path = `project-photos/${proposal.id}-${slot}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('proposals')
        .upload(path, file, { upsert: true });
      if (error) throw error;

      const next = [...paths];
      next[slot] = path;
      const ok = await persist(next.filter(Boolean));
      if (ok) {
        setPaths(next.filter(Boolean));
        toast.success(`Photo ${slot + 1} uploaded`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const removeAt = async (slot: number) => {
    const next = paths.filter((_, i) => i !== slot);
    const ok = await persist(next);
    if (ok) {
      setPaths(next);
      toast.success('Photo removed');
    }
  };

  return (
    <SectionCard
      title="Project Photos"
      icon={<ImageIcon size={14} className="text-faint" />}
      description="Up to two photos of past work. Photo 1 becomes the cover hero; Photo 2 sits before the scope of works."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((slot) => {
          const path = paths[slot];
          const url = path ? urls[path] : undefined;
          const isUploading = uploadingSlot === slot;
          return (
            <div key={slot} className="space-y-2">
              <div className="text-xs font-medium text-dim">
                Photo {slot + 1}
                <span className="text-faint font-normal ml-1.5">
                  · {slot === 0 ? 'cover hero' : 'feature image'}
                </span>
              </div>
              <div className="aspect-[16/10] rounded-lg border border-dashed border-edge-strong bg-surface overflow-hidden relative group">
                {url ? (
                  <>
                    <img
                      src={url}
                      alt={`Project photo ${slot + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAt(slot)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 text-red-500 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputs.current[slot]?.click()}
                    disabled={isUploading}
                    className="w-full h-full flex flex-col items-center justify-center gap-2 text-faint hover:text-prose hover:bg-gray-100 transition-colors"
                  >
                    {isUploading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Upload size={20} />
                    )}
                    <span className="text-xs">
                      {isUploading ? 'Uploading…' : 'Click to upload'}
                    </span>
                    <span className="text-2xs text-faint">JPG/PNG · max 4 MB</span>
                  </button>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[slot] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(slot, file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
