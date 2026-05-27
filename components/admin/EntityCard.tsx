// components/admin/EntityCard.tsx
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Trash2, FolderOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type CoverStyle,
  buildCoverBg,
  hexToRgba,
  formatDate,
} from '@/lib/entity-card-helpers';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface EntityCardProps {
  /** URL to navigate to when the user clicks the cover or title. */
  href: string;
  title: string;
  /** Short metadata line below the title (e.g. "Acme Corp · proposal description"). */
  subtitle?: string | null;
  /** Optional description shown on the cover preview when there's no cover image (templates use this). */
  coverDescription?: string | null;
  cover: CoverStyle;
  /** Real page count, used as the fallback display when no cover. */
  pageCount: number;
  /** Pre-formatted file-size string (e.g. "2.4 MB") shown under the page count. */
  fileSize?: string | null;
  createdAt: string | null;
  aspectRatio?: '16/10' | '4/3';
  /** Badge in the top-left of the cover preview (e.g. "Quote"). */
  coverTopLeftBadge?: ReactNode;
  /** Pill rendered next to the title in the body (e.g. "Quote" for templates). */
  bodyTitleBadge?: ReactNode;
  /** Optional content rendered after the subtitle (e.g. StatusDropdown for proposals). */
  body?: ReactNode;
  /** Action buttons rendered on the left of the footer (Open, Link, Preview, Use). */
  actions: ReactNode;
  onDelete: () => void;
  deleteTitle?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EntityCard({
  href,
  title,
  subtitle,
  coverDescription,
  cover,
  pageCount,
  fileSize,
  createdAt,
  aspectRatio = '16/10',
  coverTopLeftBadge,
  bodyTitleBadge,
  body,
  actions,
  onDelete,
  deleteTitle = 'Delete',
}: EntityCardProps) {
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!cover.enabled || !cover.imagePath) {
      setCoverImageUrl(null);
      return;
    }
    supabase.storage
      .from('proposals')
      .createSignedUrl(cover.imagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setCoverImageUrl(data.signedUrl);
      });
  }, [cover.enabled, cover.imagePath]);

  const aspectClass = aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-[16/10]';

  return (
    <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex flex-col">
      {/* ── Visual header — link to open ─────────────────────── */}
      <Link
        href={href}
        className={`block w-full ${aspectClass} rounded-t-2xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative`}
        style={cover.enabled ? { backgroundColor: cover.bgColor1 || '#0f0f0f' } : undefined}
      >
        {cover.enabled ? (
          <>
            <div className="absolute inset-0" style={buildCoverBg(cover)} />
            {coverImageUrl && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverImageUrl})` }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: hexToRgba(
                      cover.bgColor1 || '#0f0f0f',
                      cover.overlayOpacity ?? 0.65,
                    ),
                  }}
                />
              </>
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <h4
                className="text-sm font-semibold leading-snug line-clamp-2"
                style={{ color: cover.textColor || '#ffffff' }}
              >
                {title}
              </h4>
              {coverDescription && (
                <p
                  className="text-detail mt-1 opacity-70 truncate"
                  style={{ color: cover.subtitleColor || cover.textColor || '#ffffff' }}
                >
                  {coverDescription}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center p-5">
            {pageCount > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-ink">{pageCount}</span>
                  <span className="text-sm text-faint font-medium">page{pageCount !== 1 ? 's' : ''}</span>
                </div>
                {fileSize && <span className="text-xs text-faint">{fileSize}</span>}
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-tint flex items-center justify-center mx-auto mb-2">
                  <FolderOpen size={22} className="text-teal" />
                </div>
                <p className="text-xs text-faint">No pages yet</p>
              </div>
            )}
          </div>
        )}

        {/* Date overlay */}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-2xs font-medium text-faint shadow-sm">
          {formatDate(createdAt)}
        </span>

        {/* Optional top-left badge (e.g. Quote on a proposal) */}
        {coverTopLeftBadge && (
          <span className="absolute top-2.5 left-2.5">
            {coverTopLeftBadge}
          </span>
        )}
      </Link>

      {/* ── Card body ────────────────────────────────────────── */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <Link
            href={href}
            className="text-base font-semibold text-ink truncate cursor-pointer hover:text-teal transition-colors"
          >
            {title}
          </Link>
          {bodyTitleBadge}
        </div>

        {subtitle && (
          <p className="text-xs text-faint truncate mb-2.5">
            {subtitle}
          </p>
        )}

        {body && (
          <div className="mb-3" onClick={(e) => e.stopPropagation()}>
            {body}
          </div>
        )}

        <div className="flex-1" />

        {/* ── Actions ──────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-edge pt-2.5 -mx-3.5 px-3.5">
          <div className="flex items-center gap-0.5">{actions}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            title={deleteTitle}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
