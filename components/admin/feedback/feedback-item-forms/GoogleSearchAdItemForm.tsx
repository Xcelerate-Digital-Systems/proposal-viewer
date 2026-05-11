'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Link2, Phone, AlignLeft, Type, Building2, Slash } from 'lucide-react';
import type { GoogleAdData, GoogleAdSitelink } from '@/lib/types/feedback';
import GoogleSearchAdMockupPreview from '@/components/admin/feedback/GoogleSearchAdMockupPreview';
import FormActions from './FormActions';

interface Props {
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  uploading: boolean;
  onPreviewChange?: (visible: boolean) => void;
}

const MAX_HEADLINES = 15;
const MAX_DESCRIPTIONS = 4;
const MAX_SITELINKS = 6;
const HEADLINE_LIMIT = 30;
const DESCRIPTION_LIMIT = 90;
const PATH_LIMIT = 15;
const SITELINK_TEXT_LIMIT = 25;
const SITELINK_DESC_LIMIT = 35;

function newSitelink(): GoogleAdSitelink {
  return { id: cryptoRandomId(), text: '', url: '', description1: '', description2: '' };
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function normaliseDisplayUrl(finalUrl: string): string {
  const t = finalUrl.trim();
  if (!t) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.host.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export default function GoogleSearchAdItemForm({ onSubmit, onBack, onCancel, uploading, onPreviewChange }: Props) {
  const [title, setTitle] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [path1, setPath1] = useState('');
  const [path2, setPath2] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [headlines, setHeadlines] = useState<string[]>(['', '', '']);
  const [descriptions, setDescriptions] = useState<string[]>(['', '']);
  const [sitelinks, setSitelinks] = useState<GoogleAdSitelink[]>([]);
  const [callPhone, setCallPhone] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  /* Collapsible sections — open by default for the headline+desc+sitelink+call core */
  const [open, setOpen] = useState<Record<string, boolean>>({
    url: true, path: true, headlines: true, descriptions: true, sitelinks: false, call: false, business: false,
  });

  const togglePreview = () => {
    const next = !showPreview;
    setShowPreview(next);
    onPreviewChange?.(next);
  };

  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const displayUrl = useMemo(() => normaliseDisplayUrl(finalUrl), [finalUrl]);

  const trimmedHeadlines = headlines.map((h) => h.trim()).filter(Boolean);
  const trimmedDescriptions = descriptions.map((d) => d.trim()).filter(Boolean);
  const trimmedSitelinks = sitelinks
    .map((s) => ({ ...s, text: s.text.trim(), url: s.url.trim(), description1: s.description1?.trim(), description2: s.description2?.trim() }))
    .filter((s) => s.text && s.url);

  const canSubmit = !!title.trim() && !!finalUrl.trim() && trimmedHeadlines.length >= 3 && trimmedDescriptions.length >= 2;

  const setHeadline = (i: number, v: string) => {
    setHeadlines((prev) => { const next = [...prev]; next[i] = v.slice(0, HEADLINE_LIMIT); return next; });
  };
  const setDescription = (i: number, v: string) => {
    setDescriptions((prev) => { const next = [...prev]; next[i] = v.slice(0, DESCRIPTION_LIMIT); return next; });
  };
  const addHeadline = () => headlines.length < MAX_HEADLINES && setHeadlines((p) => [...p, '']);
  const removeHeadline = (i: number) => setHeadlines((p) => p.filter((_, idx) => idx !== i));
  const addDescription = () => descriptions.length < MAX_DESCRIPTIONS && setDescriptions((p) => [...p, '']);
  const removeDescription = (i: number) => setDescriptions((p) => p.filter((_, idx) => idx !== i));

  const addSitelink = () => sitelinks.length < MAX_SITELINKS && setSitelinks((p) => [...p, newSitelink()]);
  const removeSitelink = (id: string) => setSitelinks((p) => p.filter((s) => s.id !== id));
  const updateSitelink = (id: string, patch: Partial<GoogleAdSitelink>) =>
    setSitelinks((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const data: GoogleAdData = {
      final_url: finalUrl.trim(),
      display_url: displayUrl,
      path1: path1.trim() || undefined,
      path2: path2.trim() || undefined,
      business_name: businessName.trim() || undefined,
      headlines: trimmedHeadlines,
      descriptions: trimmedDescriptions,
      sitelinks: trimmedSitelinks,
      call_phone: callPhone.trim() || undefined,
    };

    await onSubmit({
      title: title.trim(),
      type: 'google_search_ad',
      google_ad_data: data,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex">
      <div className={`${showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-5 space-y-3 overflow-y-auto`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Item Title <span className="text-red-400">*</span></label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder="e.g. Brand keywords — search ad"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>

        <Section icon={Link2} title="Final URL" open={open.url} onToggle={() => toggle('url')} required>
          <div>
            <input
              type="url" value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
            <p className="text-[11px] text-gray-400 mt-1">The URL Google sends visitors to when they click the ad.</p>
          </div>
        </Section>

        <Section icon={Slash} title="Display path" open={open.path} onToggle={() => toggle('path')}>
          <div className="space-y-2">
            <p className="text-[11px] text-gray-500 font-mono">{displayUrl || 'example.com'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-stretch rounded-lg border border-gray-200 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20 overflow-hidden">
                  <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200">/</span>
                  <input
                    type="text" value={path1} onChange={(e) => setPath1(e.target.value.slice(0, PATH_LIMIT))}
                    className="flex-1 px-2 py-2 text-xs text-gray-900 focus:outline-none min-w-0"
                  />
                </div>
                <CharCount value={path1} limit={PATH_LIMIT} />
              </div>
              <div>
                <div className="flex items-stretch rounded-lg border border-gray-200 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20 overflow-hidden">
                  <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200">/</span>
                  <input
                    type="text" value={path2} onChange={(e) => setPath2(e.target.value.slice(0, PATH_LIMIT))}
                    className="flex-1 px-2 py-2 text-xs text-gray-900 focus:outline-none min-w-0"
                  />
                </div>
                <CharCount value={path2} limit={PATH_LIMIT} />
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Type} title={`Headlines ${trimmedHeadlines.length}/${MAX_HEADLINES}`} open={open.headlines} onToggle={() => toggle('headlines')} required>
          <div className="space-y-2">
            {headlines.map((h, i) => (
              <div key={i}>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text" value={h} onChange={(e) => setHeadline(i, e.target.value)}
                    placeholder={`Headline ${i + 1}`}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
                  />
                  {headlines.length > 3 && (
                    <button type="button" onClick={() => removeHeadline(i)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <CharCount value={h} limit={HEADLINE_LIMIT} required={i < 3} />
              </div>
            ))}
            {headlines.length < MAX_HEADLINES && (
              <button type="button" onClick={addHeadline} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-medium text-gray-500 hover:border-teal hover:text-teal transition-colors">
                <Plus size={14} /> Add headline
              </button>
            )}
            <p className="text-[11px] text-gray-400">Up to 15 headlines, 30 characters each. Google rotates and combines them.</p>
          </div>
        </Section>

        <Section icon={AlignLeft} title={`Descriptions ${trimmedDescriptions.length}/${MAX_DESCRIPTIONS}`} open={open.descriptions} onToggle={() => toggle('descriptions')} required>
          <div className="space-y-2">
            {descriptions.map((d, i) => (
              <div key={i}>
                <div className="flex items-start gap-2">
                  <textarea
                    value={d} onChange={(e) => setDescription(i, e.target.value)} rows={2}
                    placeholder={`Description ${i + 1}`}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 resize-y min-h-[56px]"
                  />
                  {descriptions.length > 2 && (
                    <button type="button" onClick={() => removeDescription(i)} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <CharCount value={d} limit={DESCRIPTION_LIMIT} required={i < 2} />
              </div>
            ))}
            {descriptions.length < MAX_DESCRIPTIONS && (
              <button type="button" onClick={addDescription} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-medium text-gray-500 hover:border-teal hover:text-teal transition-colors">
                <Plus size={14} /> Add description
              </button>
            )}
          </div>
        </Section>

        <Section icon={Link2} title={`Sitelinks ${trimmedSitelinks.length}/${MAX_SITELINKS}`} open={open.sitelinks} onToggle={() => toggle('sitelinks')}>
          <div className="space-y-3">
            {sitelinks.map((s, i) => (
              <div key={s.id} className="space-y-2 p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Sitelink {i + 1}</span>
                  <button type="button" onClick={() => removeSitelink(s.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <input
                    type="text" value={s.text} maxLength={SITELINK_TEXT_LIMIT}
                    onChange={(e) => updateSitelink(s.id, { text: e.target.value })}
                    placeholder="Sitelink text (e.g. Pricing & Sizes)"
                    className="w-full px-3 py-2 bg-white rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 border border-gray-200"
                  />
                  <CharCount value={s.text} limit={SITELINK_TEXT_LIMIT} />
                </div>
                <input
                  type="url" value={s.url}
                  onChange={(e) => updateSitelink(s.id, { url: e.target.value })}
                  placeholder="https://example.com/pricing"
                  className="w-full px-3 py-2 bg-white rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 border border-gray-200 font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text" value={s.description1 || ''} maxLength={SITELINK_DESC_LIMIT}
                      onChange={(e) => updateSitelink(s.id, { description1: e.target.value })}
                      placeholder="Description 1 (optional)"
                      className="w-full px-3 py-2 bg-white rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 border border-gray-200"
                    />
                    <CharCount value={s.description1 || ''} limit={SITELINK_DESC_LIMIT} />
                  </div>
                  <div>
                    <input
                      type="text" value={s.description2 || ''} maxLength={SITELINK_DESC_LIMIT}
                      onChange={(e) => updateSitelink(s.id, { description2: e.target.value })}
                      placeholder="Description 2 (optional)"
                      className="w-full px-3 py-2 bg-white rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 border border-gray-200"
                    />
                    <CharCount value={s.description2 || ''} limit={SITELINK_DESC_LIMIT} />
                  </div>
                </div>
              </div>
            ))}
            {sitelinks.length < MAX_SITELINKS && (
              <button type="button" onClick={addSitelink} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-medium text-gray-500 hover:border-teal hover:text-teal transition-colors">
                <Plus size={14} /> Add sitelink
              </button>
            )}
          </div>
        </Section>

        <Section icon={Phone} title="Call extension" open={open.call} onToggle={() => toggle('call')}>
          <input
            type="tel" value={callPhone} onChange={(e) => setCallPhone(e.target.value)}
            placeholder="+61 478 013 893"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <p className="text-[11px] text-gray-400 mt-1">Optional. Shown as a tap-to-call button on mobile previews.</p>
        </Section>

        <Section icon={Building2} title="Business name" open={open.business} onToggle={() => toggle('business')}>
          <input
            type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value.slice(0, 25))}
            placeholder="e.g. SWAT Bins"
            className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <CharCount value={businessName} limit={25} />
        </Section>

        <FormActions
          onBack={onBack}
          onCancel={onCancel}
          disabled={!canSubmit || uploading}
          uploading={uploading}
          previewToggle={{ visible: showPreview, enabled: true, onToggle: togglePreview }}
        />
      </div>

      {showPreview && (
        <div className="w-1/2 p-5 overflow-y-auto bg-gray-50 flex items-start justify-center">
          <GoogleSearchAdMockupPreview
            data={{
              final_url: finalUrl,
              display_url: displayUrl,
              path1, path2,
              business_name: businessName,
              headlines: trimmedHeadlines.length ? trimmedHeadlines : ['Your headline here'],
              descriptions: trimmedDescriptions.length ? trimmedDescriptions : ['Your description appears here.'],
              sitelinks: trimmedSitelinks,
              call_phone: callPhone || undefined,
            }}
          />
        </div>
      )}
    </form>
  );
}

/* ─── Small primitives ──────────────────────────────────────────── */

function Section({
  icon: Icon, title, open, onToggle, required, children,
}: {
  icon: typeof Link2;
  title: string;
  open: boolean;
  onToggle: () => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <Icon size={14} className="text-gray-500 shrink-0" />
        <span className="flex-1 text-left text-sm font-medium text-gray-800">
          {title}{required && <span className="text-red-400 ml-1">*</span>}
        </span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function CharCount({ value, limit, required }: { value: string; limit: number; required?: boolean }) {
  const over = value.length > limit;
  return (
    <p className={`text-[10px] mt-0.5 text-right ${over ? 'text-red-500' : 'text-gray-400'}`}>
      {value.length}/{limit}{required ? ' · required' : ''}
    </p>
  );
}
