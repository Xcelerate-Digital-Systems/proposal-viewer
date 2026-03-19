// components/admin/shared/InlineTextPageCanvas.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TiptapLink from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useRef } from 'react';
import { DynamicFieldExtension } from '@/components/admin/text-editor/DynamicFieldExtension';
import { FontSizeExtension } from '@/components/admin/text-editor/FontSizeExtension';
import { FontWeightExtension } from '@/components/admin/text-editor/FontWeightExtension';
import RichTextToolbar from '@/components/admin/text-editor/RichTextToolbar';
import { CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';
import { fontFamily } from '@/lib/google-fonts';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import type { TextPageForm } from './useTextPagesEditor';
import '@/components/admin/text-editor/rich-text-editor.css';

interface InlineTextPageCanvasProps {
  form: TextPageForm;
  branding: CompanyBranding;
  onUpdate: (content: unknown) => void;
}

export default function InlineTextPageCanvas({ form, branding, onUpdate }: InlineTextPageCanvasProps) {
  // Mirror the same color derivation as TextPage.tsx
  const bgColor      = branding.text_page_bg_color || branding.bg_secondary || '#141414';
  const textColor    = branding.text_page_text_color || branding.sidebar_text_color || '#ffffff';
  const headingColor = branding.text_page_heading_color || textColor;
  const fontSize     = parseInt(branding.text_page_font_size || '14', 10);
  const accent       = branding.accent_color || '#01434A';
  const border       = deriveBorderColor(bgColor);
  const muted        = `${textColor}99`;

  const bodyFont      = fontFamily(branding.font_body, 'system-ui, sans-serif');
  const headingFont   = fontFamily(branding.title_font_family || branding.font_heading, 'system-ui, sans-serif');
  const headingWeight = Number(branding.title_font_weight || branding.font_heading_weight || '700');
  const h2Weight      = Math.min(headingWeight, 600);

  // Background image (mirrors ViewerBackground logic)
  const hasBgImage     = !!branding.bg_image_url;
  const overlayOpacity = branding.bg_image_overlay_opacity ?? 0.85;
  const bgBlur         = branding.bg_image_blur ?? 0;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing… Use the Fields button in the toolbar to insert dynamic fields.' }),
      TiptapUnderline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSizeExtension,
      FontWeightExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TiptapLink.configure({ openOnClick: false }),
      DynamicFieldExtension,
    ],
    content: form.content as Record<string, unknown>,
    onUpdate: ({ editor: ed }) => onUpdate(ed.getJSON()),
  });

  // Sync content when page selection changes
  const contentRef = useRef(form.content);
  useEffect(() => {
    if (editor && form.content !== contentRef.current) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(form.content);
      if (currentJson !== newJson) {
        editor.commands.setContent(form.content as Record<string, unknown>);
      }
      contentRef.current = form.content;
    }
  }, [editor, form.content]);

  return (
    <>
      {/* Load branded fonts into the page so the editor renders them */}
      <GoogleFontLoader fonts={[branding.font_body, branding.font_heading, branding.title_font_family]} />

      <div className="flex flex-col h-full rounded-xl" style={{ border: `1px solid ${border}` }}>
        {/* Toolbar — shrink-0 so it stays at top while canvas scrolls */}
        {editor && (
          <div className="shrink-0 relative z-10">
            <RichTextToolbar editor={editor} className="rounded-t-xl" />
          </div>
        )}

        {/* Brand-styled canvas — flex-1 fills remaining height, content scrolls inside */}
        <div
          className="tp-canvas relative overflow-hidden rounded-b-xl flex-1"
          style={{ backgroundColor: hasBgImage ? (branding.bg_primary || '#0f0f0f') : bgColor }}
        >
          {/* Background image + overlay — absolute, not part of scroll flow */}
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

          <style>{`
            .tp-canvas .ProseMirror {
              color: ${textColor};
              font-family: ${bodyFont};
              font-size: ${fontSize}px;
              line-height: 1.8;
              min-height: 420px;
              padding: 40px 64px 56px;
            }
            .tp-canvas .ProseMirror p {
              color: ${textColor};
              line-height: 1.8;
              margin: 0.5em 0;
            }
            .tp-canvas .ProseMirror h1 {
              color: ${headingColor};
              font-family: ${headingFont};
              font-weight: ${headingWeight};
              font-size: 24px;
              margin: 1em 0 0.5em;
              line-height: 1.3;
            }
            .tp-canvas .ProseMirror h2 {
              color: ${headingColor};
              font-family: ${headingFont};
              font-weight: ${h2Weight};
              font-size: 20px;
              margin: 0.8em 0 0.4em;
              line-height: 1.3;
            }
            .tp-canvas .ProseMirror h3 {
              color: ${headingColor};
              font-family: ${headingFont};
              font-weight: ${h2Weight};
              font-size: 17px;
              margin: 0.6em 0 0.3em;
              line-height: 1.3;
            }
            .tp-canvas .ProseMirror ul,
            .tp-canvas .ProseMirror ol { color: ${textColor}; }
            .tp-canvas .ProseMirror blockquote {
              border-left-color: ${accent};
              color: ${muted};
            }
            .tp-canvas .ProseMirror hr { border-top-color: ${border}; }
            .tp-canvas .ProseMirror a { color: ${accent}; }
            .tp-canvas .ProseMirror code {
              background: ${textColor}10;
              color: ${textColor};
            }
            .tp-canvas .ProseMirror pre {
              background: ${textColor}08;
              border: 1px solid ${border};
              color: ${textColor};
            }
            .tp-canvas .ProseMirror p.is-editor-empty:first-child::before {
              color: ${textColor}35;
            }
          `}</style>

          {/* Scroll container — sits above bg layers, content scrolls within canvas bounds */}
          <div className="absolute inset-0 overflow-y-auto">
            <div className="relative">
              {/* Page title preview (non-editable — edit in settings panel) */}
              {form.show_title && form.title && (
                <div style={{ padding: '40px 64px 0' }}>
                  <h1
                    style={{
                      color: headingColor,
                      fontFamily: headingFont,
                      fontWeight: headingWeight,
                      fontSize: 28,
                      lineHeight: 1.3,
                      marginBottom: '0.5em',
                    }}
                  >
                    {form.title}
                  </h1>
                </div>
              )}

              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
