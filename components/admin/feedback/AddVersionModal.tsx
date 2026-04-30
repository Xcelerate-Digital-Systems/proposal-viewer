'use client';

import { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import type { FeedbackItem, FeedbackItemVersion } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface AddVersionModalProps {
  item: FeedbackItem;
  nextVersionNumber: number;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: {
    notes?: string | null;
    assets: Partial<FeedbackItemVersion>;
  }) => Promise<FeedbackItemVersion | null>;
  onUploadAsset: (file: File) => Promise<string | null>;
}

type AssetKind = 'file' | 'text' | 'ad' | 'google_ad' | 'meta_lead_form';

function assetKindForType(type: FeedbackItem['type']): AssetKind {
  if (type === 'email' || type === 'sms') return 'text';
  if (type === 'ad') return 'ad';
  if (type === 'google_ad') return 'google_ad';
  if (type === 'meta_lead_form') return 'meta_lead_form';
  return 'file'; // image, video, pdf
}

function fileAccept(type: FeedbackItem['type']): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'pdf')   return 'application/pdf';
  if (type === 'ad' || type === 'google_ad' || type === 'meta_lead_form') return 'image/*';
  return '*';
}

/** Which DB column holds the uploaded URL for a given item type. */
function fileTargetField(type: FeedbackItem['type']): keyof FeedbackItemVersion {
  if (type === 'image') return 'image_url';
  if (type === 'video') return 'video_url';
  if (type === 'pdf') return 'pdf_url';
  return 'ad_creative_url';
}

export default function AddVersionModal({
  item, nextVersionNumber, creating, onClose, onSubmit, onUploadAsset,
}: AddVersionModalProps) {
  const toast = useToast();
  const kind = assetKindForType(item.type);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  // Text variants
  const [emailSubject, setEmailSubject] = useState(item.email_subject ?? '');
  const [emailPreheader, setEmailPreheader] = useState(item.email_preheader ?? '');
  const [emailBody, setEmailBody] = useState(item.email_body ?? '');
  const [smsBody, setSmsBody] = useState(item.sms_body ?? '');

  // Meta ad copy
  const [adHeadline, setAdHeadline] = useState(item.ad_headline ?? '');
  const [adCopy, setAdCopy] = useState(item.ad_copy ?? '');
  const [adCta, setAdCta] = useState(item.ad_cta ?? '');

  // Meta lead form (copy-iteration version: swap cover + edit headline/description/CTA)
  const lf = item.meta_lead_form_data;
  const [lfHeadline, setLfHeadline] = useState(lf?.intro_headline ?? '');
  const [lfDescription, setLfDescription] = useState(lf?.intro_description ?? '');
  const [lfCta, setLfCta] = useState(lf?.cta ?? 'Continue');

  // Google ad copy
  const [gadHeadline, setGadHeadline] = useState(item.google_ad_headline ?? '');
  const [gadDesc1, setGadDesc1] = useState(item.google_ad_description1 ?? '');
  const [gadDesc2, setGadDesc2] = useState(item.google_ad_description2 ?? '');
  const [gadDisplayUrl, setGadDisplayUrl] = useState(item.google_ad_display_url ?? '');
  const [gadFinalUrl, setGadFinalUrl] = useState(item.google_ad_final_url ?? '');

  const [uploading, setUploading] = useState(false);
  const busy = uploading || creating;

  const handleSubmit = async () => {
    setUploading(true);
    const assets: Partial<FeedbackItemVersion> = {};

    try {
      if (kind === 'file') {
        if (!file) { toast.error('Choose a file'); setUploading(false); return; }
        const url = await onUploadAsset(file);
        if (!url) { setUploading(false); return; }
        (assets as Record<string, unknown>)[fileTargetField(item.type) as string] = url;
      }

      if (kind === 'text') {
        if (item.type === 'email') {
          if (!emailBody.trim()) { toast.error('Body is required'); setUploading(false); return; }
          assets.email_subject = emailSubject || null;
          assets.email_preheader = emailPreheader || null;
          assets.email_body = emailBody;
        } else {
          if (!smsBody.trim()) { toast.error('Body is required'); setUploading(false); return; }
          assets.sms_body = smsBody;
        }
      }

      if (kind === 'ad') {
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          assets.ad_creative_url = url;
        }
        assets.ad_headline = adHeadline || null;
        assets.ad_copy = adCopy || null;
        assets.ad_cta = adCta || null;
        assets.ad_platform = item.ad_platform;
      }

      if (kind === 'meta_lead_form') {
        if (!lf) {
          toast.error('Lead form not configured');
          setUploading(false);
          return;
        }
        let coverUrl = lf.cover_url;
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          coverUrl = url;
        }
        assets.meta_lead_form_data = {
          ...lf,
          cover_url: coverUrl,
          intro_headline: lfHeadline,
          intro_description: lfDescription,
          cta: lfCta,
        };
      }

      if (kind === 'google_ad') {
        if (file) {
          const url = await onUploadAsset(file);
          if (!url) { setUploading(false); return; }
          assets.ad_creative_url = url;
        }
        assets.google_ad_format = item.google_ad_format;
        assets.google_ad_headline = gadHeadline || null;
        assets.google_ad_description1 = gadDesc1 || null;
        assets.google_ad_description2 = gadDesc2 || null;
        assets.google_ad_display_url = gadDisplayUrl || null;
        assets.google_ad_final_url = gadFinalUrl || null;
      }

      const result = await onSubmit({ notes: notes.trim() || null, assets });
      if (result) onClose();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-[0_24px_48px_rgba(20,20,40,0.18)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-ink">Upload Version {nextVersionNumber}</h3>
            <p className="text-[12px] text-gray-500 mt-0.5 truncate max-w-[360px]">{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {kind === 'file' && (
            <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} />
          )}

          {kind === 'text' && item.type === 'email' && (
            <>
              <Field label="Subject">
                <input className={inputCls} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </Field>
              <Field label="Preheader">
                <input className={inputCls} value={emailPreheader} onChange={(e) => setEmailPreheader(e.target.value)} />
              </Field>
              <Field label="Body">
                <textarea className={`${inputCls} min-h-[120px]`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
              </Field>
            </>
          )}

          {kind === 'text' && item.type === 'sms' && (
            <Field label="Body">
              <textarea className={`${inputCls} min-h-[120px]`} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} />
            </Field>
          )}

          {kind === 'ad' && (
            <>
              <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
              <Field label="Headline">
                <input className={inputCls} value={adHeadline} onChange={(e) => setAdHeadline(e.target.value)} />
              </Field>
              <Field label="Primary text">
                <textarea className={`${inputCls} min-h-[80px]`} value={adCopy} onChange={(e) => setAdCopy(e.target.value)} />
              </Field>
              <Field label="Call to action">
                <input className={inputCls} value={adCta} onChange={(e) => setAdCta(e.target.value)} />
              </Field>
            </>
          )}

          {kind === 'meta_lead_form' && (
            <>
              <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
              <Field label="Intro headline">
                <input className={inputCls} value={lfHeadline} onChange={(e) => setLfHeadline(e.target.value)} />
              </Field>
              <Field label="Intro description">
                <textarea className={`${inputCls} min-h-[80px]`} value={lfDescription} onChange={(e) => setLfDescription(e.target.value)} />
              </Field>
              <Field label="CTA button">
                <input className={inputCls} value={lfCta} onChange={(e) => setLfCta(e.target.value)} />
              </Field>
              <p className="text-[11px] text-gray-500 -mt-1">
                To edit questions or other pages, edit the item directly.
              </p>
            </>
          )}

          {kind === 'google_ad' && (
            <>
              {item.google_ad_format === 'display' && (
                <FileInput file={file} onChange={setFile} accept={fileAccept(item.type)} optional />
              )}
              <Field label="Headline">
                <input className={inputCls} value={gadHeadline} onChange={(e) => setGadHeadline(e.target.value)} />
              </Field>
              <Field label="Description 1">
                <input className={inputCls} value={gadDesc1} onChange={(e) => setGadDesc1(e.target.value)} />
              </Field>
              <Field label="Description 2">
                <input className={inputCls} value={gadDesc2} onChange={(e) => setGadDesc2(e.target.value)} />
              </Field>
              <Field label="Display URL">
                <input className={inputCls} value={gadDisplayUrl} onChange={(e) => setGadDisplayUrl(e.target.value)} />
              </Field>
              <Field label="Final URL">
                <input className={inputCls} value={gadFinalUrl} onChange={(e) => setGadFinalUrl(e.target.value)} />
              </Field>
            </>
          )}

          <Field label="Version notes (optional)">
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. tightened copy, swapped hero shot"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-full disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal text-white text-[13px] font-semibold rounded-full hover:bg-teal-hover disabled:opacity-60 transition-colors shadow-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? 'Saving…' : 'Save Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tiny presentational bits ─────────────────────────────────────── */

const inputCls = 'w-full px-3 py-2 bg-gray-50 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-teal/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function FileInput({
  file, onChange, accept, optional,
}: { file: File | null; onChange: (f: File | null) => void; accept: string; optional?: boolean }) {
  return (
    <Field label={optional ? 'New file (optional)' : 'New file'}>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-200 file:text-[12px] file:font-medium file:bg-gray-50 hover:file:bg-gray-100"
        />
        {file && <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{file.name}</span>}
      </div>
    </Field>
  );
}
