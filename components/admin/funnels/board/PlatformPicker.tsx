'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Loader2, Trash2 } from 'lucide-react';
import { FUNNEL_ICON_LIBRARY } from '@/lib/types/funnel';
import { StepIcon, isFullColourBrand } from './nodes/FunnelStepNode';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';

interface Props {
  platform: string | null;
  onChange: (slug: string | null) => void;
}

interface CustomLogo {
  id: string;
  name: string;
  url: string;
}

/** Offered platforms come from the picker's own "CRM & Tools" group, so the
 *  badge list and the icon list can't drift apart — adding a logo there makes
 *  it selectable here automatically. */
const PLATFORM_SLUGS =
  FUNNEL_ICON_LIBRARY.find((g) => g.group === 'CRM & Tools')?.icons ?? [];

const ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Marks which system a node runs in.
 *
 * Separate from the node's own icon on purpose: a "Qualified" pipeline stage
 * should keep its tick and gain a GoHighLevel badge, rather than surrender its
 * meaning to the platform's logo. Swap the icon itself when the node *is* the
 * platform; set a platform badge when the node merely lives inside one.
 *
 * Built-ins are stored as a catalogue slug ('ghl'); uploaded logos are stored
 * as their public URL, which keeps the public viewer free of any extra lookup.
 */
export default function PlatformPicker({ platform, onChange }: Props) {
  const toast = useToast();
  const [logos, setLogos] = useState<CustomLogo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLogos = useCallback(async () => {
    try {
      const res = await authFetch('/api/funnel/logos');
      if (res.ok) setLogos(await res.json());
    } catch { /* non-fatal — the built-ins still work */ }
  }, []);

  useEffect(() => { void loadLogos(); }, [loadLogos]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await authFetch('/api/funnel/logos', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Upload failed');
        return;
      }
      setLogos((prev) => [data, ...prev]);
      onChange(data.url);
      toast.success('Logo added');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = async (logo: CustomLogo) => {
    setLogos((prev) => prev.filter((l) => l.id !== logo.id));
    if (platform === logo.url) onChange(null);
    await authFetch(`/api/funnel/logos?id=${logo.id}`, { method: 'DELETE' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted">
          Runs in
        </h4>
        {platform && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-0.5 text-2xs text-muted hover:text-rose-600 transition-colors"
            title="Remove platform badge"
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1">
        {PLATFORM_SLUGS.map((slug) => {
          const active = platform === slug;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => onChange(active ? null : slug)}
              className={`w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden transition-colors ${
                active ? 'ring-2 ring-teal' : 'border border-edge hover:border-teal/50'
              }`}
              title={slug}
            >
              <StepIcon
                slug={slug}
                size={15}
                brandSize={15}
                fillContainer={isFullColourBrand(slug)}
                onLightSurface
              />
            </button>
          );
        })}

        {logos.map((logo) => {
          const active = platform === logo.url;
          return (
            <button
              key={logo.id}
              type="button"
              onClick={() => onChange(active ? null : logo.url)}
              onContextMenu={(e) => { e.preventDefault(); void removeLogo(logo); }}
              className={`group relative w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden transition-colors ${
                active ? 'ring-2 ring-teal' : 'border border-edge hover:border-teal/50'
              }`}
              title={`${logo.name} — right-click to remove`}
            >
              <img src={logo.url} alt={logo.name} className="w-full h-full object-contain p-0.5" />
              <span className="absolute inset-0 bg-ink/60 text-white items-center justify-center hidden group-hover:flex">
                <Trash2
                  size={10}
                  onClick={(e) => { e.stopPropagation(); void removeLogo(logo); }}
                />
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-7 h-7 rounded-lg border border-dashed border-edge text-muted hover:border-teal hover:text-teal flex items-center justify-center transition-colors disabled:opacity-50"
          title="Upload a logo (PNG, JPEG or WebP, max 512KB)"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <p className="text-2xs text-muted/70 mt-1 leading-snug">
        Shows a logo badge on the node. Upload your own for anything not listed —
        PNG, JPEG or WebP, up to 512KB.
      </p>
    </div>
  );
}
