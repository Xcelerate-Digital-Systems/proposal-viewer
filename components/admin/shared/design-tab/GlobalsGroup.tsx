'use client';

import type { ReactNode } from 'react';
import {
  RotateCcw, Hash, LayoutPanelTop, Paintbrush,
} from 'lucide-react';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import FontSelect from '@/components/admin/shared/FontSelect';
import ColorPickerField from '@/components/ui/ColorPickerField';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import { FontSizeInput } from './design-helpers';
import {
  type PageOrientation, type TextPageDefaults,
  orientationOptions,
} from './DesignTabTypes';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface GlobalsGroupProps {
  /* Orientation */
  pageOrientation: PageOrientation;
  setPageOrientation: (v: PageOrientation) => void;
  /* Title font */
  titleFontFamily: string | null;
  setTitleFontFamily: (v: string | null) => void;
  titleFontWeight: string | null;
  setTitleFontWeight: (v: string | null) => void;
  titleFontSize: string;
  setTitleFontSize: (v: string) => void;
  titleFontTransform: string | null;
  setTitleFontTransform: (v: string | null) => void;
  /* Heading + body + button fonts */
  fontHeadingFamily: string | null;
  setFontHeadingFamily: (v: string | null) => void;
  fontHeadingWeight: string | null;
  setFontHeadingWeight: (v: string | null) => void;
  fontHeadingSize: string;
  setFontHeadingSize: (v: string) => void;
  fontHeadingTransform: string | null;
  setFontHeadingTransform: (v: string | null) => void;
  fontBodyFamily: string | null;
  setFontBodyFamily: (v: string | null) => void;
  fontBodyWeight: string | null;
  setFontBodyWeight: (v: string | null) => void;
  fontBodySize: string;
  setFontBodySize: (v: string) => void;
  fontBodyTransform: string | null;
  setFontBodyTransform: (v: string | null) => void;
  fontButtonFamily: string | null;
  setFontButtonFamily: (v: string | null) => void;
  fontButtonWeight: string | null;
  setFontButtonWeight: (v: string | null) => void;
  /* Text page colours */
  tpBgColor: string;
  setTpBgColor: (v: string) => void;
  tpTextColor: string;
  setTpTextColor: (v: string) => void;
  tpHeadingColor: string;
  setTpHeadingColor: (v: string) => void;
  /* Page number badge */
  pageNumCircleColor: string | null;
  setPageNumCircleColor: (v: string | null) => void;
  pageNumTextColor: string | null;
  setPageNumTextColor: (v: string | null) => void;
  /* Defaults & actions */
  companyDefaults: TextPageDefaults;
  onTpResetToCompany: () => void;
  /* Background image block (rendered by parent) */
  backgroundImageBlock: ReactNode;
  /* Preview content */
  entityTitle?: string;
  bodySnippet: string | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GlobalsGroup({
  pageOrientation,
  setPageOrientation,
  titleFontFamily,
  setTitleFontFamily,
  titleFontWeight,
  setTitleFontWeight,
  titleFontSize,
  setTitleFontSize,
  titleFontTransform,
  setTitleFontTransform,
  fontHeadingFamily,
  setFontHeadingFamily,
  fontHeadingWeight,
  setFontHeadingWeight,
  fontHeadingSize,
  setFontHeadingSize,
  fontHeadingTransform,
  setFontHeadingTransform,
  fontBodyFamily,
  setFontBodyFamily,
  fontBodyWeight,
  setFontBodyWeight,
  fontBodySize,
  setFontBodySize,
  fontBodyTransform,
  setFontBodyTransform,
  fontButtonFamily,
  setFontButtonFamily,
  fontButtonWeight,
  setFontButtonWeight,
  tpBgColor,
  setTpBgColor,
  tpTextColor,
  setTpTextColor,
  tpHeadingColor,
  setTpHeadingColor,
  pageNumCircleColor,
  setPageNumCircleColor,
  pageNumTextColor,
  setPageNumTextColor,
  companyDefaults,
  onTpResetToCompany,
  backgroundImageBlock,
  entityTitle,
  bodySnippet,
}: GlobalsGroupProps) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-5">
        <SectionCard
          title="Global Page Defaults"
          description="Orientation and typography — applied across text, pricing, and packages pages."
          icon={<LayoutPanelTop size={14} className="text-faint" />}
        >
          <div className="space-y-5">
            {/* Orientation — compact chip row */}
            <div>
              <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-2">Orientation</p>
              <div className="flex gap-2">
                {orientationOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPageOrientation(opt.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      pageOrientation === opt.key
                        ? 'bg-teal/10 border-teal/40 text-teal font-medium'
                        : 'bg-white border-edge-strong text-dim hover:bg-surface'
                    }`}
                  >
                    <span className={`rounded-sm border-2 flex-shrink-0 ${
                      pageOrientation === opt.key ? 'border-teal' : 'border-edge-hover'
                    } ${opt.key === 'landscape' ? 'w-4 h-3.5' : 'w-3.5 h-4'}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="pt-4 border-t border-edge">
              <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-3">Typography</p>
              <div className="space-y-4">
                <FontSelect
                  label="Page title font"
                  description="The big H1 at the top of every page. Leave blank to use the Heading font."
                  value={titleFontFamily}
                  onChange={setTitleFontFamily}
                  weight={titleFontWeight}
                  onWeightChange={setTitleFontWeight}
                  transform={titleFontTransform}
                  onTransformChange={setTitleFontTransform}
                  hideInlinePreview
                />
                <FontSizeInput
                  label="Title size"
                  value={titleFontSize}
                  onChange={setTitleFontSize}
                  placeholder="36"
                />
                <FontSelect
                  label="Heading font"
                  description={
                    companyDefaults.font_heading
                      ? `Section H2/H3 inside body. Workspace default: ${companyDefaults.font_heading}.`
                      : 'Section H2/H3 inside body. Leave blank to inherit the workspace default.'
                  }
                  value={fontHeadingFamily}
                  onChange={setFontHeadingFamily}
                  weight={fontHeadingWeight}
                  onWeightChange={setFontHeadingWeight}
                  transform={fontHeadingTransform}
                  onTransformChange={setFontHeadingTransform}
                  hideInlinePreview
                />
                <FontSizeInput
                  label="Heading size"
                  value={fontHeadingSize}
                  onChange={setFontHeadingSize}
                  placeholder="18"
                />
                <FontSelect
                  label="Body font"
                  description={
                    companyDefaults.font_body
                      ? `Paragraph copy. Workspace default: ${companyDefaults.font_body}.`
                      : 'Paragraph copy. Leave blank to inherit the workspace default.'
                  }
                  value={fontBodyFamily}
                  onChange={setFontBodyFamily}
                  weight={fontBodyWeight}
                  onWeightChange={setFontBodyWeight}
                  transform={fontBodyTransform}
                  onTransformChange={setFontBodyTransform}
                  hideInlinePreview
                />
                <FontSizeInput
                  label="Body size"
                  value={fontBodySize}
                  onChange={setFontBodySize}
                  placeholder={companyDefaults.font_size || '14'}
                />
                <FontSelect
                  label="Button font"
                  description="Cover call-to-action button. Leave blank to use the Heading font."
                  value={fontButtonFamily}
                  onChange={setFontButtonFamily}
                  weight={fontButtonWeight}
                  onWeightChange={setFontButtonWeight}
                  hideInlinePreview
                />
              </div>
            </div>

          </div>
        </SectionCard>

        {/* Page Colours + Background Image */}
        <SectionCard
          title="Page Colours"
          description="Background, body text, headings, and background image. Applies to text, pricing and packages pages."
          icon={<Paintbrush size={14} className="text-faint" />}
          action={
            <button
              onClick={onTpResetToCompany}
              className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            <ColorPickerField
              label="Background"
              value={tpBgColor}
              fallback={companyDefaults.bg_color}
              onChange={setTpBgColor}
            />
            <ColorPickerField
              label="Body Text"
              value={tpTextColor}
              fallback={companyDefaults.text_color}
              onChange={setTpTextColor}
            />
            <ColorPickerField
              label="Headings"
              value={tpHeadingColor}
              fallback={companyDefaults.heading_color || companyDefaults.text_color}
              onChange={setTpHeadingColor}
            />

            <div className="pt-3 border-t border-edge">
              <p className="text-detail font-semibold text-dim uppercase tracking-wider mb-2">Background Image</p>
              {backgroundImageBlock}
            </div>
          </div>
        </SectionCard>

        {/* Page Number Badge */}
        <SectionCard
          title="Page Number Badge"
          description="Leave blank to use your accent colour (circle) and white (text)."
          icon={<Hash size={14} className="text-faint" />}
          action={
            <button
              onClick={() => {
                setPageNumCircleColor(null);
                setPageNumTextColor(null);
              }}
              className="flex items-center gap-1.5 text-xs text-faint hover:text-teal transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          }
        >
          <div className="space-y-4">
            <ColorPickerField
              label="Circle Colour"
              value={pageNumCircleColor}
              fallback={companyDefaults.accent_color}
              onChange={setPageNumCircleColor}
              onReset={() => setPageNumCircleColor(null)}
            />
            <ColorPickerField
              label="Text Colour"
              value={pageNumTextColor}
              fallback="#ffffff"
              onChange={setPageNumTextColor}
              onReset={() => setPageNumTextColor(null)}
            />
          </div>
        </SectionCard>
      </div>

      <StickyPreviewAside>
        <GoogleFontLoader fonts={[
          titleFontFamily || fontHeadingFamily || companyDefaults.font_heading,
          fontHeadingFamily || companyDefaults.font_heading,
          fontBodyFamily || companyDefaults.font_body,
        ]} />
        <div
          className="rounded-lg overflow-hidden border border-edge-strong bg-surface p-8 space-y-4"
          style={{ backgroundColor: tpBgColor || companyDefaults.bg_color }}
        >
          <p
            className="leading-tight"
            style={{
              color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
              fontFamily: fontFamily(titleFontFamily || fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
              fontWeight: Number(titleFontWeight || fontHeadingWeight || '600'),
              fontSize: titleFontSize ? `${titleFontSize}px` : '36px',
              textTransform: (titleFontTransform || fontHeadingTransform || 'none') as React.CSSProperties['textTransform'],
            }}
          >
            {entityTitle || 'Sample page title'}
          </p>
          <p
            className="leading-snug"
            style={{
              color: tpHeadingColor || companyDefaults.heading_color || companyDefaults.text_color,
              fontFamily: fontFamily(fontHeadingFamily || companyDefaults.font_heading, 'system-ui, sans-serif'),
              fontWeight: fontHeadingWeight ? Number(fontHeadingWeight) : undefined,
              fontSize: fontHeadingSize ? `${fontHeadingSize}px` : '22px',
              textTransform: (fontHeadingTransform || 'none') as React.CSSProperties['textTransform'],
            }}
          >
            A section heading
          </p>
          <p
            className="leading-relaxed"
            style={{
              color: tpTextColor || companyDefaults.text_color,
              fontFamily: fontFamily(fontBodyFamily || companyDefaults.font_body, 'system-ui, sans-serif'),
              fontWeight: Number(fontBodyWeight || '400'),
              fontSize: fontBodySize ? `${fontBodySize}px` : `${companyDefaults.font_size || '15'}px`,
              textTransform: (fontBodyTransform || 'none') as React.CSSProperties['textTransform'],
            }}
          >
            {bodySnippet || 'Body text on a proposal page. This is what your client will read — adjust the body font, weight, and colour to match your brand voice.'}
          </p>
        </div>
      </StickyPreviewAside>
    </div>
  );
}
