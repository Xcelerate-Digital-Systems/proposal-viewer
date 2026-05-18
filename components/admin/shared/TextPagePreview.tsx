// components/admin/shared/TextPagePreview.tsx
'use client';

import { useMemo } from 'react';
import TextPage from '@/components/viewer/TextPage';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import { CompanyBranding, ProposalTextPage } from '@/hooks/useProposal';
import type { TextPageForm } from './useTextPagesEditor';

interface TextPagePreviewProps {
  form: TextPageForm;
  branding: CompanyBranding;
  entityId: string;
  companyId: string | null;
}

export default function TextPagePreview({ form, branding, entityId, companyId }: TextPagePreviewProps) {
  const textPage: ProposalTextPage = useMemo(() => ({
    id: 'preview',
    proposal_id: entityId,
    company_id: companyId ?? '',
    enabled: form.enabled,
    position: 0,
    title: form.title,
    content: form.content,
    sort_order: 0,
    indent: 0,
    show_member_badge: form.show_member_badge,
    show_client_logo: form.show_client_logo,
    prepared_by_member_id: form.prepared_by_member_id,
    show_title: form.show_title,
  }), [form, entityId, companyId]);

  const bgColor = branding.text_page_bg_color || branding.bg_secondary || '#141414';
  const hasBgImage = !!branding.bg_image_url;
  const overlayOpacity = branding.bg_image_overlay_opacity ?? 0.85;
  const bgBlur = branding.bg_image_blur ?? 0;

  return (
    <div className="flex flex-col h-full rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div className="shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Live preview</span>
        <span className="text-[10px] text-gray-400">Read-only · matches viewer</span>
      </div>

      <GoogleFontLoader fonts={[branding.font_body, branding.font_heading, branding.title_font_family]} />

      <div
        className="relative flex-1 overflow-y-auto"
        style={{ backgroundColor: hasBgImage ? (branding.bg_primary || '#0f0f0f') : bgColor }}
      >
        {hasBgImage && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url(${branding.bg_image_url})`,
                filter: bgBlur ? `blur(${bgBlur}px)` : undefined,
                transform: bgBlur ? 'scale(1.05)' : undefined,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: branding.bg_primary || '#0f0f0f', opacity: overlayOpacity }}
            />
          </>
        )}

        <div className="relative">
          <TextPage
            textPage={textPage}
            branding={branding}
            proposalTitle=""
            clientName=""
            companyName=""
            userName=""
          />
        </div>
      </div>
    </div>
  );
}
