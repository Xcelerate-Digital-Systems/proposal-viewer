'use client';

import { useState, useCallback } from 'react';
import { Download, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import type { CompanyBranding } from '@/lib/types/branding';
import type { MetaAdVariant } from '@/lib/types/feedback';
import DOMPurify from 'isomorphic-dompurify';

export type HandoffItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  sort_order: number;
  url: string | null;
  ad_headline: string | null;
  ad_copy: string | null;
  ad_cta: string | null;
  ad_creative_url: string | null;
  ad_platform: string | null;
  meta_ad_variants: MetaAdVariant[] | null;
  email_subject: string | null;
  email_preheader: string | null;
  email_body: string | null;
  sms_body: string | null;
  image_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  google_ad_data: Record<string, unknown> | null;
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 shrink-0"
      title={`Copy ${label || 'text'}`}
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? 'Copied' : label || 'Copy'}
    </button>
  );
}

function DownloadButton({ url, filename }: { url: string; filename?: string }) {
  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [url, filename]);

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 shrink-0"
    >
      <Download size={12} />
      Download
    </button>
  );
}

function AdCopyBlock({ item }: { item: HandoffItem }) {
  const variants = item.meta_ad_variants;
  const hasVariants = variants && variants.length > 0;

  if (hasVariants) {
    return (
      <div className="space-y-3">
        {variants.map((v, i) => (
          <div key={v.id || i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {v.label || `Variant ${i + 1}`}
              </span>
            </div>
            <div className="space-y-2.5">
              {v.headline && (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xs font-medium text-gray-500 mb-0.5">Headline</div>
                    <div className="text-sm text-gray-900">{v.headline}</div>
                  </div>
                  <CopyButton text={v.headline} label="Headline" />
                </div>
              )}
              {v.primary_text && (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-2xs font-medium text-gray-500 mb-0.5">Primary Text</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">{v.primary_text}</div>
                  </div>
                  <CopyButton text={v.primary_text} label="Text" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!item.ad_headline && !item.ad_copy && !item.ad_cta) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2.5">
      {item.ad_headline && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xs font-medium text-gray-500 mb-0.5">Headline</div>
            <div className="text-sm text-gray-900">{item.ad_headline}</div>
          </div>
          <CopyButton text={item.ad_headline} label="Headline" />
        </div>
      )}
      {item.ad_copy && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xs font-medium text-gray-500 mb-0.5">Primary Text</div>
            <div className="text-sm text-gray-900 whitespace-pre-wrap">{item.ad_copy}</div>
          </div>
          <CopyButton text={item.ad_copy} label="Text" />
        </div>
      )}
      {item.ad_cta && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xs font-medium text-gray-500 mb-0.5">Call to Action</div>
            <div className="text-sm text-gray-900">{item.ad_cta}</div>
          </div>
          <CopyButton text={item.ad_cta} label="CTA" />
        </div>
      )}
    </div>
  );
}

function AdItemCard({ item, branding }: { item: HandoffItem; branding: CompanyBranding }) {
  const creativeUrl = item.ad_creative_url || item.image_url;
  const videoUrl = item.video_url;
  const hasCreative = creativeUrl || videoUrl;
  const hasCopy = item.ad_headline || item.ad_copy || item.ad_cta ||
    (item.meta_ad_variants && item.meta_ad_variants.length > 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
        {item.ad_platform && (
          <span className="text-2xs text-gray-500 capitalize">{item.ad_platform}</span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {hasCreative && (
          <div>
            {videoUrl ? (
              <div className="space-y-2">
                <video
                  src={videoUrl}
                  controls
                  className="w-full max-h-[320px] rounded-lg bg-black object-contain"
                />
                <DownloadButton url={videoUrl} filename={`${item.title}.mp4`} />
              </div>
            ) : creativeUrl ? (
              <div className="space-y-2">
                <img
                  src={creativeUrl}
                  alt={item.title}
                  className="w-full max-h-[320px] rounded-lg object-contain bg-white border border-gray-100"
                />
                <DownloadButton url={creativeUrl} filename={item.title} />
              </div>
            ) : null}
          </div>
        )}
        {hasCopy && <AdCopyBlock item={item} />}
      </div>
    </div>
  );
}

function ImageItemCard({ item }: { item: HandoffItem }) {
  const url = item.image_url;
  if (!url) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
      </div>
      <div className="p-5 space-y-2">
        <img src={url} alt={item.title} loading="lazy" className="w-full max-h-[320px] rounded-lg object-contain bg-white border border-gray-100" />
        <DownloadButton url={url} filename={item.title} />
      </div>
    </div>
  );
}

function VideoItemCard({ item }: { item: HandoffItem }) {
  const url = item.video_url;
  if (!url) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
      </div>
      <div className="p-5 space-y-2">
        <video src={url} controls className="w-full max-h-[320px] rounded-lg bg-black object-contain" />
        <DownloadButton url={url} filename={`${item.title}.mp4`} />
      </div>
    </div>
  );
}

function WebpageItemCard({ item }: { item: HandoffItem }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 shrink-0"
          >
            <ExternalLink size={12} />
            Open
          </a>
        )}
      </div>
      {item.url && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={13} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate font-mono">{item.url}</span>
            <CopyButton text={item.url} label="URL" />
          </div>
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white" style={{ height: 400 }}>
            <iframe
              src={item.url}
              title={item.title}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmailItemCard({ item }: { item: HandoffItem }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
      </div>
      <div className="p-5 space-y-2.5">
        {item.email_subject && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xs font-medium text-gray-500 mb-0.5">Subject</div>
              <div className="text-sm text-gray-900">{item.email_subject}</div>
            </div>
            <CopyButton text={item.email_subject} label="Subject" />
          </div>
        )}
        {item.email_preheader && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xs font-medium text-gray-500 mb-0.5">Preheader</div>
              <div className="text-sm text-gray-900">{item.email_preheader}</div>
            </div>
            <CopyButton text={item.email_preheader} label="Preheader" />
          </div>
        )}
        {item.email_body && (
          <div>
            <div className="text-2xs font-medium text-gray-500 mb-1">Body</div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div
                className="text-sm text-gray-900 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.email_body) }}
              />
            </div>
            <div className="mt-2">
              <CopyButton text={item.email_body} label="HTML" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmsItemCard({ item }: { item: HandoffItem }) {
  if (!item.sms_body) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-gray-900 whitespace-pre-wrap">{item.sms_body}</div>
          <CopyButton text={item.sms_body} label="SMS" />
        </div>
      </div>
    </div>
  );
}

function PdfItemCard({ item }: { item: HandoffItem }) {
  if (!item.pdf_url) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
        <DownloadButton url={item.pdf_url} filename={`${item.title}.pdf`} />
      </div>
    </div>
  );
}

function GoogleAdItemCard({ item }: { item: HandoffItem }) {
  const data = item.google_ad_data;
  if (!data) return null;

  const headlines = (data.headlines as string[]) || [];
  const descriptions = (data.descriptions as string[]) || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
        <span className="text-2xs text-gray-500">{item.type === 'google_search_ad' ? 'Search Ad' : 'Banner Ad'}</span>
      </div>
      <div className="p-5 space-y-3">
        {headlines.length > 0 && (
          <div>
            <div className="text-2xs font-medium text-gray-500 mb-1.5">Headlines</div>
            <div className="space-y-1.5">
              {headlines.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="text-sm text-gray-900">{h}</span>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          </div>
        )}
        {descriptions.length > 0 && (
          <div>
            <div className="text-2xs font-medium text-gray-500 mb-1.5">Descriptions</div>
            <div className="space-y-1.5">
              {descriptions.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="text-sm text-gray-900">{d}</span>
                  <CopyButton text={d} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ItemCard({ item, branding }: { item: HandoffItem; branding: CompanyBranding }) {
  switch (item.type) {
    case 'ad': return <AdItemCard item={item} branding={branding} />;
    case 'image': return <ImageItemCard item={item} />;
    case 'video': return <VideoItemCard item={item} />;
    case 'webpage': return <WebpageItemCard item={item} />;
    case 'email': return <EmailItemCard item={item} />;
    case 'sms': return <SmsItemCard item={item} />;
    case 'google_search_ad':
    case 'google_banner_ad': return <GoogleAdItemCard item={item} />;
    case 'pdf': return <PdfItemCard item={item} />;
    default: return null;
  }
}
