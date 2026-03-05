// components/viewer/TocPage.tsx
'use client';

import { useMemo } from 'react';
import { CompanyBranding } from '@/hooks/useProposal';
import { TocSettings, PageNameEntry } from '@/lib/supabase';
import { fontFamily } from '@/lib/google-fonts';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TocEntry {
  label: string;
  pageNumber: number;    // virtual page number (0 for groups)
  isGroup: boolean;
  indent: number;
}

/** Minimal page sequence entry — matches the shape from buildPageMap */
export type PageSequenceEntry =
  | { type: 'pdf'; pdfPage: number }
  | { type: 'pricing' }
  | { type: 'packages'; packagesId?: string }
  | { type: 'text'; textPageId: string }
  | { type: 'toc' };

interface TocPageProps {
  tocSettings: TocSettings;
  branding: CompanyBranding;
  pageEntries: PageNameEntry[];
  pageSequence: PageSequenceEntry[];
  numPages: number;
  companyName?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function TocPage({
  tocSettings,
  branding,
  pageEntries,
  pageSequence,
  numPages,
  companyName,
}: TocPageProps) {
  const accent = branding.accent_color || '#ff6700';
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const textColor = branding.cover_text_color || '#ffffff';
  const subtitleColor = branding.cover_subtitle_color || '#ffffffb3';
  const headingFont = fontFamily(branding.title_font_family || branding.font_heading);
  const bodyFont = fontFamily(branding.font_body);
  const excludedSet = useMemo(
    () => new Set(tocSettings.excluded_items),
    [tocSettings.excluded_items]
  );

  // Build TOC entries from pageEntries, using pageSequence to determine type for exclusion
  const entries: TocEntry[] = useMemo(() => {
    const result: TocEntry[] = [];
    let virtualPage = 0; // 1-indexed virtual page counter (only for non-group entries)
    let seqIdx = 0;      // index into pageSequence

    for (let i = 0; i < pageEntries.length; i++) {
      const entry = pageEntries[i];
      const isGroup = entry.type === 'group';

      if (!isGroup) {
        virtualPage++;
        if (virtualPage > numPages) break;
      }

      // Determine the exclusion identifier using the page sequence
      let itemId: string;
      if (isGroup) {
        itemId = `group:${entry.name}`;
      } else if (seqIdx < pageSequence.length) {
        const seq = pageSequence[seqIdx];
        if (seq.type === 'pdf') {
          itemId = `pdf:${seq.pdfPage}`;
        } else if (seq.type === 'pricing') {
          itemId = 'pricing';
        } else if (seq.type === 'packages') {
          itemId = seq.packagesId ? `packages:${seq.packagesId}` : 'packages';
        } else if (seq.type === 'text') {
          itemId = `text:${seq.textPageId}`;
        } else if (seq.type === 'toc') {
          // Skip the TOC page itself — don't list it in the TOC
          seqIdx++;
          continue;
        } else {
          itemId = `pdf:${virtualPage}`;
        }
        seqIdx++;
      } else {
        itemId = `pdf:${virtualPage}`;
      }

      // Skip excluded items
      if (excludedSet.has(itemId)) continue;

      result.push({
        label: entry.name || `Page ${virtualPage}`,
        pageNumber: isGroup ? 0 : virtualPage,
        isGroup,
        indent: entry.indent || 0,
      });
    }
    return result;
  }, [pageEntries, pageSequence, numPages, excludedSet]);

  // Auto two-column when there are more than 8 entries
  const isTwoCol = entries.length > 8;
  const splitAt = Math.ceil(entries.length / 2);
  const leftEntries = isTwoCol ? entries.slice(0, splitAt) : entries;
  const rightEntries = isTwoCol ? entries.slice(splitAt) : [];

  const renderEntries = (list: TocEntry[]) =>
    list.map((entry, idx) => {
      if (entry.isGroup) {
        return (
          <div key={`group-${idx}`} className={`${idx > 0 ? 'mt-8' : ''} mb-1`}>
            <span
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: subtitleColor, fontFamily: bodyFont }}
            >
              {entry.label}
            </span>
          </div>
        );
      }

      return (
        <div
          key={`entry-${idx}`}
          style={{ paddingLeft: entry.indent > 0 ? '24px' : '0' }}
        >
          <div className="flex items-center justify-between py-3">
            <span
              className={`font-bold uppercase tracking-wide ${isTwoCol ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}
              style={{ color: textColor, fontFamily: headingFont }}
            >
              {entry.label}
            </span>

            <span
              className={`font-bold tabular-nums ml-6 shrink-0 ${isTwoCol ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}
              style={{ color: textColor, fontFamily: headingFont }}
            >
              {entry.pageNumber}
            </span>
          </div>

          {/* Accent underline bar */}
          <div
            className="h-[3px] rounded-full"
            style={{ backgroundColor: accent, width: '28px' }}
          />
        </div>
      );
    });

  return (
    <div
      className="h-full flex items-center justify-center py-12 px-8 overflow-hidden"
      style={{ backgroundColor: branding.bg_image_url ? 'transparent' : bgPrimary }}
    >
      <div className="w-full max-w-5xl">
        {/* Title — last word highlighted in accent colour */}
        <div className={isTwoCol ? 'mb-10' : 'mb-14'}>
          {(() => {
            const words = (tocSettings.title || 'Table of Contents').split(' ');
            const lastWord = words.pop() || '';
            const firstWords = words.join(' ');
            return (
              <h1
                className={`font-black uppercase leading-tight ${isTwoCol ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-3xl md:text-4xl lg:text-5xl'}`}
                style={{
                  fontFamily: headingFont,
                  color: textColor,
                  fontWeight: Number(branding.title_font_weight || branding.font_heading_weight || '900'),
                  ...(branding.title_font_size ? { fontSize: `${branding.title_font_size}px` } : {}),
                }}
              >
                {firstWords && (
                  <>
                    {firstWords}
                    <br />
                  </>
                )}
                <span style={{ color: accent }}>{lastWord}</span>
              </h1>
            );
          })()}
        </div>

        {/* TOC entries — single or two-column */}
        {isTwoCol ? (
          <div className="grid grid-cols-2 gap-x-12">
            <div>{renderEntries(leftEntries)}</div>
            <div>{renderEntries(rightEntries)}</div>
          </div>
        ) : (
          <div>{renderEntries(leftEntries)}</div>
        )}

        {/* Footer */}
        {companyName && (
          <div className={`${isTwoCol ? 'mt-10' : 'mt-20'} flex items-center justify-end`}>
            <span
              className="text-[10px] uppercase tracking-[0.25em] font-medium"
              style={{ color: subtitleColor, fontFamily: bodyFont }}
            >
              {companyName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}