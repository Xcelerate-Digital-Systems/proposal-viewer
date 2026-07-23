'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { X, ChevronDown, Check, GripVertical, Image as ImageIcon } from 'lucide-react';
import type { FeedbackItem } from '@/lib/supabase';
import type { VersionView } from '@/lib/feedback/versions';
import { applyVersion } from '@/lib/feedback/versions';
import { defaultViewForItem, type FeedbackItemView } from '@/lib/types/feedback';

// Reuse existing mockup components
import AdMockupPreview, { type AdPlatform } from '@/components/admin/feedback/AdMockupPreview';
import EmailMockupPreview, { type EmailClient } from '@/components/admin/feedback/EmailMockupPreview';
import SmsMockupPreview, { type SmsClient } from '@/components/admin/feedback/SmsMockupPreview';
import GoogleSearchAdMockupPreview from '@/components/admin/feedback/GoogleSearchAdMockupPreview';
import GoogleBannerAdMockupPreview from '@/components/admin/feedback/GoogleBannerAdMockupPreview';
import MetaLeadFormMockupPreview, { type MetaLeadFormPage } from '@/components/admin/feedback/MetaLeadFormMockupPreview';
import { emptyGoogleAdData, getMetaAdVariants } from '@/lib/types/feedback';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface VersionCompareViewProps {
  item: FeedbackItem;
  versions: VersionView[];
  onClose: () => void;
  accentColor?: string;
  brandName?: string;
}

type CompareMode = 'side-by-side' | 'slider';

/* ================================================================== */
/*  Simple word-level diff for text content                            */
/* ================================================================== */

function diffWords(oldText: string, newText: string): { text: string; type: 'same' | 'removed' | 'added' }[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: { text: string; type: 'same' | 'removed' | 'added' }[] = [];
  let i = m, j = n;
  const stack: { text: string; type: 'same' | 'removed' | 'added' }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ text: oldWords[i - 1], type: 'same' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ text: newWords[j - 1], type: 'added' });
      j--;
    } else {
      stack.push({ text: oldWords[i - 1], type: 'removed' });
      i--;
    }
  }

  stack.reverse();

  // Merge consecutive same-type segments
  for (const seg of stack) {
    if (result.length > 0 && result[result.length - 1].type === seg.type) {
      result[result.length - 1].text += seg.text;
    } else {
      result.push({ ...seg });
    }
  }

  return result;
}

function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const segments = useMemo(() => diffWords(oldText, newText), [oldText, newText]);
  if (oldText === newText) {
    return <span className="text-sm text-prose whitespace-pre-wrap">{oldText}</span>;
  }
  return (
    <span className="text-sm whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'same') return <span key={i} className="text-prose">{seg.text}</span>;
        if (seg.type === 'removed') return <span key={i} className="bg-red-100 text-red-800 line-through rounded px-0.5">{seg.text}</span>;
        return <span key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{seg.text}</span>;
      })}
    </span>
  );
}

/* ================================================================== */
/*  Version selector dropdown (compact, used in each panel)            */
/* ================================================================== */

function PanelVersionSelector({
  versions,
  selectedId,
  onChange,
  label,
}: {
  versions: VersionView[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = versions.find((v) => (v.id ?? null) === selectedId) || versions[0];
  const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-edge px-3 py-1.5 text-xs font-semibold text-ink hover:border-edge-hover transition-colors"
      >
        <span className="text-faint text-2xs uppercase tracking-wider">{label}</span>
        <span className="tabular-nums">v{selected.versionNumber}</span>
        <ChevronDown size={11} className="text-faint" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-white border border-edge rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
          {ordered.map((v) => {
            const isActive = (v.id ?? null) === selectedId;
            return (
              <button
                key={v.id ?? 'v1'}
                type="button"
                onClick={() => { onChange(v.id); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface ${isActive ? 'bg-surface' : ''}`}
              >
                <span className="text-xs font-semibold text-ink tabular-nums shrink-0">
                  v{v.versionNumber}
                </span>
                <span className="text-xs text-dim truncate flex-1">
                  {v.notes || (v.versionNumber === 1 ? 'Initial version' : 'New version')}
                </span>
                <span className="text-2xs text-faint shrink-0">
                  {formatDate(v.createdAt)}
                </span>
                {isActive && <Check size={12} className="text-teal shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Readonly content renderer (no pins, no highlights, no interactions) */
/* ================================================================== */

function ReadonlyContent({
  item,
  accentColor,
  brandName,
}: {
  item: FeedbackItem;
  accentColor?: string;
  brandName?: string;
}) {
  const displayBrandName = brandName?.trim() || 'Your Brand';
  const defaultView = defaultViewForItem(item);

  // Image items
  if (item.type === 'image' || (item.type === 'figma' && item.image_url)) {
    const url = item.image_url;
    if (!url) return <EmptyPlaceholder text="No image" />;
    return (
      <div className="bg-surface rounded-xl overflow-hidden">
        <div className="flex items-center justify-center bg-white p-2">
          <img
            src={url}
            alt={item.title}
            className="max-w-full max-h-[60vh] object-contain select-none"
            draggable={false}
          />
        </div>
      </div>
    );
  }

  // Ad items
  if (item.type === 'ad' && item.ad_creative_url) {
    const variants = getMetaAdVariants(item);
    const platform = (item.ad_platform as AdPlatform) || 'facebook_feed';
    return (
      <AdMockupPreview
        creativeUrl={item.ad_creative_url}
        ctaText={item.ad_cta || 'Learn More'}
        platform={platform}
        pageName={displayBrandName}
        showPlatformToggle={false}
        accentColor={accentColor}
        headline={variants[0]?.headline || item.ad_headline || ''}
        primaryText={variants[0]?.primary_text || item.ad_copy || ''}
      />
    );
  }

  // Email items
  if (item.type === 'email') {
    const client = (defaultView as EmailClient | null) || 'inbox_preview';
    return (
      <EmailMockupPreview
        subject={item.email_subject || ''}
        preheader={item.email_preheader || ''}
        body={item.email_body || ''}
        senderName={displayBrandName}
        client={client}
        showClientToggle={false}
        accentColor={accentColor}
      />
    );
  }

  // SMS items
  if (item.type === 'sms') {
    const client = (defaultView as SmsClient | null) || 'imessage';
    return (
      <SmsMockupPreview
        body={item.sms_body || ''}
        senderName={displayBrandName}
        client={client}
        showClientToggle={false}
        accentColor={accentColor}
      />
    );
  }

  // Google Search Ad
  if (item.type === 'google_search_ad') {
    const data = item.google_ad_data || emptyGoogleAdData();
    return <GoogleSearchAdMockupPreview data={data} />;
  }

  // Google Banner Ad
  if (item.type === 'google_banner_ad') {
    const data = item.google_ad_data || emptyGoogleAdData();
    return (
      <GoogleBannerAdMockupPreview
        headline={data.headlines?.[0] || item.ad_headline || ''}
        displayUrl={data.display_url || ''}
        creativeUrl={data.banner_image_url || item.ad_creative_url || ''}
      />
    );
  }

  // Meta Lead Form
  if (item.type === 'meta_lead_form') {
    const data = item.meta_lead_form_data;
    if (!data) return <EmptyPlaceholder text="Lead form not configured" />;
    return (
      <MetaLeadFormMockupPreview
        data={data}
        page="intro"
        accentColor={accentColor}
      />
    );
  }

  // Video
  if (item.type === 'video') {
    const videoSrc = item.video_url || item.image_url || '';
    if (!videoSrc) return <EmptyPlaceholder text="No video" />;
    return (
      <div className="bg-surface rounded-xl overflow-hidden">
        <video src={videoSrc} controls className="w-full max-h-[60vh]" />
      </div>
    );
  }

  // PDF
  if (item.type === 'pdf') {
    const pdfSrc = item.pdf_url || item.image_url || '';
    if (!pdfSrc) return <EmptyPlaceholder text="No PDF" />;
    return (
      <div className="bg-surface rounded-xl overflow-hidden">
        <iframe src={pdfSrc} className="w-full border-0" style={{ height: '60vh' }} title={item.title} />
      </div>
    );
  }

  // Webpage
  if (item.type === 'webpage' && item.url) {
    return (
      <div className="bg-white rounded-xl border border-edge overflow-hidden">
        <iframe
          src={item.url}
          title={item.title}
          className="w-full border-0"
          style={{ height: '60vh' }}
          sandbox="allow-same-origin allow-scripts"
          loading="lazy"
        />
      </div>
    );
  }

  return <EmptyPlaceholder text="No preview available" />;
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ImageIcon size={28} className="text-faint mb-2" />
      <p className="text-xs text-dim">{text}</p>
    </div>
  );
}

/* ================================================================== */
/*  Image slider overlay (Frame.io style)                              */
/* ================================================================== */

function ImageSliderCompare({
  leftUrl,
  rightUrl,
  leftLabel,
  rightLabel,
}: {
  leftUrl: string;
  rightUrl: string;
  leftLabel: string;
  rightLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleMove(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-white select-none cursor-col-resize"
      onMouseDown={(e) => { e.preventDefault(); dragging.current = true; handleMove(e.clientX); }}
    >
      {/* Right image (full width, behind) */}
      <img
        src={rightUrl}
        alt="Newer version"
        className="w-full max-h-[65vh] object-contain select-none"
        draggable={false}
      />
      {/* Left image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={leftUrl}
          alt="Older version"
          className="w-full max-h-[65vh] object-contain select-none"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
          draggable={false}
        />
      </div>
      {/* Slider line + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 pointer-events-none"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-auto cursor-col-resize"
          onMouseDown={onMouseDown}
        >
          <GripVertical size={14} className="text-dim" />
        </div>
      </div>
      {/* Labels */}
      <div className="absolute top-3 left-3 z-10">
        <span className="px-2 py-1 rounded-md bg-ink/70 text-white text-2xs font-semibold backdrop-blur-sm">
          {leftLabel}
        </span>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <span className="px-2 py-1 rounded-md bg-ink/70 text-white text-2xs font-semibold backdrop-blur-sm">
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Text diff panel for email/sms content                              */
/* ================================================================== */

function TextDiffPanel({ leftItem, rightItem }: { leftItem: FeedbackItem; rightItem: FeedbackItem }) {
  // Email diff
  if (leftItem.type === 'email') {
    const fields = [
      { label: 'Subject', old: leftItem.email_subject || '', next: rightItem.email_subject || '' },
      { label: 'Preheader', old: leftItem.email_preheader || '', next: rightItem.email_preheader || '' },
      { label: 'Body', old: leftItem.email_body || '', next: rightItem.email_body || '' },
    ];
    return (
      <div className="space-y-4 p-4">
        {fields.map((f) => (
          <div key={f.label}>
            <h4 className="text-2xs uppercase tracking-wider text-faint font-semibold mb-1">{f.label}</h4>
            <DiffText oldText={f.old} newText={f.next} />
          </div>
        ))}
      </div>
    );
  }

  // SMS diff
  if (leftItem.type === 'sms') {
    return (
      <div className="p-4">
        <h4 className="text-2xs uppercase tracking-wider text-faint font-semibold mb-1">Message</h4>
        <DiffText oldText={leftItem.sms_body || ''} newText={rightItem.sms_body || ''} />
      </div>
    );
  }

  // Ad copy diff
  if (leftItem.type === 'ad') {
    const leftVariants = getMetaAdVariants(leftItem);
    const rightVariants = getMetaAdVariants(rightItem);
    const fields = [
      { label: 'Headline', old: leftVariants[0]?.headline || '', next: rightVariants[0]?.headline || '' },
      { label: 'Primary Text', old: leftVariants[0]?.primary_text || '', next: rightVariants[0]?.primary_text || '' },
    ];
    return (
      <div className="space-y-4 p-4">
        {fields.map((f) => (
          <div key={f.label}>
            <h4 className="text-2xs uppercase tracking-wider text-faint font-semibold mb-1">{f.label}</h4>
            <DiffText oldText={f.old} newText={f.next} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

/* ================================================================== */
/*  Helper: check if item type supports slider mode                    */
/* ================================================================== */

function supportsSlider(item: FeedbackItem): boolean {
  if (item.type === 'image' || item.type === 'figma') return !!item.image_url;
  if (item.type === 'ad') return !!item.ad_creative_url;
  return false;
}

function supportsTextDiff(item: FeedbackItem): boolean {
  return item.type === 'email' || item.type === 'sms' || item.type === 'ad';
}

/** Get the primary image URL for slider comparison. */
function getImageUrl(item: FeedbackItem): string | null {
  if (item.type === 'image' || item.type === 'figma') return item.image_url;
  if (item.type === 'ad') return item.ad_creative_url;
  return null;
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export default function VersionCompareView({
  item,
  versions,
  onClose,
  accentColor,
  brandName,
}: VersionCompareViewProps) {
  // Default: left = previous version, right = current (latest)
  const latestVersion = versions[versions.length - 1];
  const previousVersion = versions.length >= 2 ? versions[versions.length - 2] : versions[0];

  const [leftVersionId, setLeftVersionId] = useState<string | null>(previousVersion.id);
  const [rightVersionId, setRightVersionId] = useState<string | null>(latestVersion.id);
  const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');

  const leftVersion = versions.find((v) => (v.id ?? null) === leftVersionId) || versions[0];
  const rightVersion = versions.find((v) => (v.id ?? null) === rightVersionId) || versions[versions.length - 1];

  const leftItem = useMemo(() => applyVersion(item, leftVersion), [item, leftVersion]);
  const rightItem = useMemo(() => applyVersion(item, rightVersion), [item, rightVersion]);

  const canSlider = supportsSlider(leftItem) && supportsSlider(rightItem);
  const canTextDiff = supportsTextDiff(item);
  const showSlider = compareMode === 'slider' && canSlider;

  const leftImageUrl = getImageUrl(leftItem);
  const rightImageUrl = getImageUrl(rightItem);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-[fadeIn_150ms_ease-out]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-edge bg-white">
        <h2 className="text-sm font-semibold text-ink">Compare Versions</h2>
        <span className="text-xs text-dim">
          {item.title}
        </span>

        <div className="flex-1" />

        {/* Mode toggle */}
        {canSlider && (
          <div className="flex items-center rounded-full bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setCompareMode('side-by-side')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                compareMode === 'side-by-side'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-dim hover:text-prose'
              }`}
            >
              Side by side
            </button>
            <button
              type="button"
              onClick={() => setCompareMode('slider')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                compareMode === 'slider'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-dim hover:text-prose'
              }`}
            >
              Slider
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-surface text-prose hover:text-ink hover:bg-edge transition-colors"
          aria-label="Close comparison"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {showSlider && leftImageUrl && rightImageUrl ? (
          /* ── Slider mode ── */
          <div className="max-w-4xl mx-auto p-6">
            <ImageSliderCompare
              leftUrl={leftImageUrl}
              rightUrl={rightImageUrl}
              leftLabel={`v${leftVersion.versionNumber}`}
              rightLabel={`v${rightVersion.versionNumber}`}
            />
            {/* Version selectors below the slider */}
            <div className="flex items-center justify-between mt-4">
              <PanelVersionSelector
                versions={versions}
                selectedId={leftVersionId}
                onChange={setLeftVersionId}
                label="Left"
              />
              <PanelVersionSelector
                versions={versions}
                selectedId={rightVersionId}
                onChange={setRightVersionId}
                label="Right"
              />
            </div>

            {/* Text diff below slider for ad items */}
            {canTextDiff && (
              <div className="mt-6 bg-surface rounded-xl border border-edge">
                <div className="px-4 py-2 border-b border-edge">
                  <h3 className="text-xs font-semibold text-ink">Copy Changes</h3>
                </div>
                <TextDiffPanel leftItem={leftItem} rightItem={rightItem} />
              </div>
            )}
          </div>
        ) : (
          /* ── Side-by-side mode ── */
          <div className="flex min-h-full">
            {/* Left panel */}
            <div className="flex-1 border-r border-edge flex flex-col min-w-0">
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-warm border-b border-edge">
                <PanelVersionSelector
                  versions={versions}
                  selectedId={leftVersionId}
                  onChange={setLeftVersionId}
                  label="Left"
                />
                <span className="text-2xs text-faint">
                  {formatDate(leftVersion.createdAt)}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto">
                  <ReadonlyContent item={leftItem} accentColor={accentColor} brandName={brandName} />
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-warm border-b border-edge">
                <PanelVersionSelector
                  versions={versions}
                  selectedId={rightVersionId}
                  onChange={setRightVersionId}
                  label="Right"
                />
                <span className="text-2xs text-faint">
                  {formatDate(rightVersion.createdAt)}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto">
                  <ReadonlyContent item={rightItem} accentColor={accentColor} brandName={brandName} />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Text diff row at bottom for text-based types (side-by-side mode only) */}
        {!showSlider && canTextDiff && (
          <div className="shrink-0 bg-surface border-t border-edge max-h-[30vh] overflow-auto">
            <div className="px-5 py-2 border-b border-edge flex items-center gap-2">
              <h3 className="text-xs font-semibold text-ink">Copy Changes</h3>
              <span className="text-2xs text-faint">
                Additions in <span className="bg-amber-100 text-amber-900 px-1 rounded">amber</span>,
                removals in <span className="bg-red-100 text-red-800 line-through px-1 rounded">red</span>
              </span>
            </div>
            <TextDiffPanel leftItem={leftItem} rightItem={rightItem} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
