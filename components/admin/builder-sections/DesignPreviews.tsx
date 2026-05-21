// components/admin/builder-sections/DesignPreviews.tsx
// Tiny sticky preview components used in the Design tab. Each one loads the
// first relevant page from the entity (pricing / text) and renders the
// existing viewer preview component. Live updates after each design-tab save
// because the parent entity re-fetches and the preview re-mounts.
'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import type { CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import ViewerPagePreview from '@/components/admin/shared/ViewerPagePreview';

interface PreviewProps {
  entityId: string;
  entityKey: 'proposal_id' | 'template_id';
}

/** Live design-tab colour overrides that take precedence over whatever was
 *  last saved to the entity row. Without this, the preview only refreshes
 *  after the debounced save lands (or never, if the parent doesn't re-fetch),
 *  so adjustments don't visibly update the preview. */
export interface PricingPreviewLive {
  pricing_header_text_color: string | null;
  pricing_text_color: string | null;
  pricing_price_title_color: string | null;
  pricing_price_color: string | null;
  pricing_payment_schedule_name_color: string | null;
  pricing_payment_schedule_price_color: string | null;
}

/* ── Helper: fetch branding for an entity ───────────────────────── */
async function loadBranding(entityId: string, entityKey: 'proposal_id' | 'template_id'): Promise<CompanyBranding> {
  const table = entityKey === 'template_id' ? 'proposal_templates' : 'proposals';
  const { data: ent } = await supabase
    .from(table)
    .select('company_id, text_page_bg_color, text_page_text_color, text_page_heading_color, title_font_family, title_font_weight, title_font_size, page_num_circle_color, page_num_text_color, bg_image_path, bg_image_overlay_opacity, bg_image_blur')
    .eq('id', entityId)
    .single();
  const cid = (ent?.company_id as string | undefined) ?? null;
  let merged: CompanyBranding = { ...DEFAULT_BRANDING };
  if (cid) {
    const r = await fetch(`/api/company/branding?company_id=${cid}`);
    if (r.ok) merged = { ...merged, ...(await r.json()) };
  }
  // Entity-level overrides
  if (ent) {
    if (ent.text_page_bg_color) merged.text_page_bg_color = ent.text_page_bg_color;
    if (ent.text_page_text_color) merged.text_page_text_color = ent.text_page_text_color;
    if (ent.text_page_heading_color) merged.text_page_heading_color = ent.text_page_heading_color;
    if (ent.title_font_family) merged.title_font_family = ent.title_font_family;
    if (ent.title_font_weight) merged.title_font_weight = ent.title_font_weight;
    if (ent.title_font_size) merged.title_font_size = ent.title_font_size;
    if (ent.bg_image_path) {
      const { data: url } = supabase.storage.from('company-assets').getPublicUrl(ent.bg_image_path);
      if (url?.publicUrl) merged.bg_image_url = url.publicUrl;
      merged.bg_image_overlay_opacity = ent.bg_image_overlay_opacity ?? merged.bg_image_overlay_opacity ?? 0.85;
      merged.bg_image_blur = ent.bg_image_blur ?? 0;
    }
  }
  return merged;
}

/* ============================================================
   Pricing Design Preview
   ============================================================ */

export function PricingDesignPreview({
  entityId,
  entityKey,
  live,
}: PreviewProps & { live?: PricingPreviewLive }) {
  const [loaded, setLoaded] = useState(false);
  const [pricing, setPricing] = useState<Record<string, unknown> | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
      const res = await authFetch(`${apiBase}?${entityKey}=${entityId}`);
      if (res.ok) {
        const pages = await res.json() as Array<{ id: string; type: string; title: string; position: number; payload: Record<string, unknown> }>;
        const first = pages.filter((p) => p.type === 'pricing').sort((a, b) => a.position - b.position)[0];
        if (first && !cancelled) {
          setPricing({
            id: first.id, title: first.title, enabled: true, position: first.position, indent: 0,
            ...first.payload,
          });
        }
      }
      const b = await loadBranding(entityId, entityKey);
      if (!cancelled) {
        setBranding(b);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
        <DollarSign size={28} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">No pricing page yet</p>
        <p className="text-xs text-gray-300 mt-0.5">Add one on the Quote tab to see a preview here</p>
      </div>
    );
  }

  // Merge live colour edits over the fetched branding so adjusting a picker
  // updates the preview on the next keystroke instead of waiting for save +
  // refetch (which never happens — the parent doesn't re-mount us).
  const mergedBranding: CompanyBranding = {
    ...branding,
    ...(live?.pricing_header_text_color !== undefined
      ? { pricing_header_text_color: live.pricing_header_text_color }
      : {}),
    ...(live?.pricing_text_color !== undefined
      ? { pricing_text_color: live.pricing_text_color }
      : {}),
    ...(live?.pricing_price_title_color !== undefined
      ? { pricing_price_title_color: live.pricing_price_title_color }
      : {}),
    ...(live?.pricing_price_color !== undefined
      ? { pricing_price_color: live.pricing_price_color }
      : {}),
    ...(live?.pricing_payment_schedule_name_color !== undefined
      ? { pricing_payment_schedule_name_color: live.pricing_payment_schedule_name_color }
      : {}),
    ...(live?.pricing_payment_schedule_price_color !== undefined
      ? { pricing_payment_schedule_price_color: live.pricing_payment_schedule_price_color }
      : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PricingPreview pricing={pricing as any} branding={mergedBranding} />;
}

/* ============================================================
   Text Page Design Preview
   ============================================================ */

export function TextPageDesignPreview({ entityId, entityKey }: PreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('Text Page');
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiBase = entityKey === 'template_id' ? '/api/templates/pages' : '/api/proposals/pages';
      const res = await authFetch(`${apiBase}?${entityKey}=${entityId}`);
      if (res.ok) {
        const pages = await res.json() as Array<{ type: string; title: string; position: number }>;
        const first = pages.filter((p) => p.type === 'text').sort((a, b) => a.position - b.position)[0];
        if (first && !cancelled) setTitle(first.title || 'Text Page');
      }
      const b = await loadBranding(entityId, entityKey);
      if (!cancelled) {
        setBranding(b);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [entityId, entityKey]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const bg = branding.text_page_bg_color || '#ffffff';
  const text = branding.text_page_text_color || '#1E2432';
  const heading = branding.text_page_heading_color || text;

  return (
    <ViewerPagePreview
      branding={branding}
      label={title}
      icon={<FileText size={11} />}
      footer="Live preview · uses entity styling"
    >
      <div
        style={{ backgroundColor: bg, color: text }}
        className="w-full min-h-[100vh] px-16 py-20"
      >
        <h1
          className="font-semibold mb-6"
          style={{
            color: heading,
            fontFamily: branding.title_font_family || undefined,
            fontWeight: (branding.title_font_weight as unknown as number) || 600,
            fontSize: branding.title_font_size ? `${branding.title_font_size}px` : '36px',
          }}
        >
          {title}
        </h1>
        <p className="text-base leading-relaxed mb-4">
          This is a live preview of your text page styling. The background, body text and heading
          colours all reflect the choices you make to the left.
        </p>
        <p className="text-base leading-relaxed mb-4">
          Page title fonts come from the Globals section above, and the body of pricing and packages
          pages inherits the same colours from here so all your content pages stay visually
          consistent.
        </p>
        <h2
          className="text-2xl font-semibold mt-10 mb-4"
          style={{ color: heading }}
        >
          A second heading
        </h2>
        <p className="text-base leading-relaxed">
          Use the controls on the left to dial in your brand. Changes save automatically and this
          preview refreshes a moment later.
        </p>
      </div>
    </ViewerPagePreview>
  );
}
