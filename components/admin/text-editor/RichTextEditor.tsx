// components/admin/text-editor/RichTextEditor.tsx
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
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, Link, Link2Off,
  Undo, Redo, Code2, ChevronDown, Minus,
  Palette, Highlighter, X,
} from 'lucide-react';
import { DynamicFieldExtension, DYNAMIC_FIELDS } from './DynamicFieldExtension';
import { FontSizeExtension } from './FontSizeExtension';
import { FontWeightExtension } from './FontWeightExtension';

const FONT_SIZES = ['8', '10', '12', '14', '16', '18', '20', '24', '28', '32', '36'];

const FONT_WEIGHTS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#000000' },
  { label: 'Dark Gray', value: '#374151' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Pink', value: '#db2777' },
  { label: 'White', value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Purple', value: '#e9d5ff' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Red', value: '#fecaca' },
  { label: 'Teal', value: '#99f6e4' },
];

interface RichTextEditorProps {
  content: unknown; // TipTap JSON
  onUpdate: (content: unknown) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onUpdate, placeholder }: RichTextEditorProps) {
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fieldMenuRef = useRef<HTMLDivElement>(null);
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your content here...',
      }),
      TiptapUnderline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSizeExtension,
      FontWeightExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#017C87] underline' },
      }),
      DynamicFieldExtension,
    ],
    content: content as Record<string, unknown>,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-gray-800',
      },
    },
  });

  // Update content from outside (e.g. when switching between text pages)
  const contentRef = useRef(content);
  useEffect(() => {
    if (editor && content !== contentRef.current) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content as Record<string, unknown>);
      }
      contentRef.current = content;
    }
  }, [editor, content]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(e.target as Node)) {
        setShowFieldMenu(false);
      }
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) {
        setShowTextColorPicker(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const insertField = useCallback((field: string) => {
    editor?.chain().focus().insertDynamicField(field).run();
    setShowFieldMenu(false);
  }, [editor]);

  const setLink = useCallback(() => {
    if (!linkUrl) {
      editor?.chain().focus().unsetLink().run();
      setShowLinkInput(false);
      return;
    }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  if (!editor) return null;

  // Get current font size from selection
  const currentFontSize = editor.getAttributes('textStyle')?.fontSize?.replace('px', '') || '';
  // Get current font weight from selection
  const currentFontWeight = editor.getAttributes('textStyle')?.fontWeight || '';
  // Get current text color from selection
  const currentTextColor = editor.getAttributes('textStyle')?.color || '';
  // Get current highlight color from selection
  const currentHighlight = editor.getAttributes('highlight')?.color || '';

  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-[#017C87]/15 text-[#017C87]'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  const Separator = () => <div className="w-px h-5 bg-gray-200 mx-0.5" />;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col max-h-[70vh]">
      {/* Toolbar — stays fixed at top */}
      <div className="shrink-0 flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 z-10">
        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={14} />
        </ToolbarButton>

        <Separator />

        {/* Font size dropdown */}
        <select
          value={currentFontSize}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              editor.chain().focus().setFontSize(`${val}px`).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
          title="Font Size"
          className="h-7 px-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded cursor-pointer hover:border-gray-300 focus:outline-none focus:border-[#017C87]"
        >
          <option value="">Size</option>
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>

        {/* Font weight dropdown */}
        <select
          value={currentFontWeight}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              editor.chain().focus().setFontWeight(val).run();
            } else {
              editor.chain().focus().unsetFontWeight().run();
            }
          }}
          title="Font Weight"
          className="h-7 px-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded cursor-pointer hover:border-gray-300 focus:outline-none focus:border-[#017C87]"
          style={{ fontWeight: currentFontWeight ? Number(currentFontWeight) : undefined }}
        >
          <option value="">Weight</option>
          {FONT_WEIGHTS.map((w) => (
            <option key={w.value} value={w.value} style={{ fontWeight: Number(w.value) }}>
              {w.label}
            </option>
          ))}
        </select>

        <Separator />

        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
          <Underline size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={14} />
        </ToolbarButton>

        <Separator />

        {/* Text Color */}
        <div className="relative" ref={textColorRef}>
          <button
            type="button"
            onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowHighlightPicker(false); }}
            title="Text Color"
            className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${
              showTextColorPicker
                ? 'bg-[#017C87]/15 text-[#017C87]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="relative">
              <Palette size={14} />
              {currentTextColor && (
                <div
                  className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full"
                  style={{ backgroundColor: currentTextColor }}
                />
              )}
            </div>
          </button>
          {showTextColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 w-[180px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider">Text Color</span>
                <button
                  onClick={() => setShowTextColorPicker(false)}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value || 'default'}
                    onClick={() => {
                      if (c.value) {
                        editor.chain().focus().setColor(c.value).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                      setShowTextColorPicker(false);
                    }}
                    title={c.label}
                    className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                      currentTextColor === c.value
                        ? 'ring-2 ring-[#017C87] ring-offset-1'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: c.value || '#ffffff',
                      ...(c.value === '' ? {
                        background: 'linear-gradient(135deg, #fff 43%, #ef4444 43%, #ef4444 57%, #fff 57%)',
                      } : {}),
                    }}
                  />
                ))}
              </div>
              {/* Custom color input */}
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                <input
                  type="color"
                  value={currentTextColor || '#000000'}
                  onChange={(e) => {
                    editor.chain().focus().setColor(e.target.value).run();
                  }}
                  className="w-6 h-6 rounded border border-gray-200 cursor-pointer p-0"
                  title="Custom color"
                />
                <span className="text-[10px] text-gray-400">Custom</span>
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="relative" ref={highlightRef}>
          <button
            type="button"
            onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowTextColorPicker(false); }}
            title="Highlight Color"
            className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${
              showHighlightPicker
                ? 'bg-[#017C87]/15 text-[#017C87]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="relative">
              <Highlighter size={14} />
              {currentHighlight && (
                <div
                  className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full"
                  style={{ backgroundColor: currentHighlight }}
                />
              )}
            </div>
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 w-[170px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase text-gray-400 tracking-wider">Highlight</span>
                <button
                  onClick={() => setShowHighlightPicker(false)}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value || 'none'}
                    onClick={() => {
                      if (c.value) {
                        editor.chain().focus().toggleHighlight({ color: c.value }).run();
                      } else {
                        editor.chain().focus().unsetHighlight().run();
                      }
                      setShowHighlightPicker(false);
                    }}
                    title={c.label}
                    className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                      currentHighlight === c.value
                        ? 'ring-2 ring-[#017C87] ring-offset-1'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: c.value || '#ffffff',
                      ...(c.value === '' ? {
                        background: 'linear-gradient(135deg, #fff 43%, #ef4444 43%, #ef4444 57%, #fff 57%)',
                      } : {}),
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={14} />
        </ToolbarButton>

        <Separator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus size={14} />
        </ToolbarButton>

        <Separator />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight size={14} />
        </ToolbarButton>

        <Separator />

        {/* Link */}
        {showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
              placeholder="https://..."
              className="text-xs px-2 py-1 border border-gray-200 rounded w-40 focus:outline-none focus:border-[#017C87]"
              autoFocus
            />
            <button onClick={setLink} className="text-xs px-2 py-1 bg-[#017C87] text-white rounded hover:bg-[#01434A]">
              Set
            </button>
            <button onClick={() => setShowLinkInput(false)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        ) : (
          <>
            <ToolbarButton
              onClick={() => {
                const existing = editor.getAttributes('link').href;
                setLinkUrl(existing || '');
                setShowLinkInput(true);
              }}
              isActive={editor.isActive('link')}
              title="Insert Link"
            >
              <Link size={14} />
            </ToolbarButton>
            {editor.isActive('link') && (
              <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
                <Link2Off size={14} />
              </ToolbarButton>
            )}
          </>
        )}

        <Separator />

        {/* Dynamic fields */}
        <div className="relative" ref={fieldMenuRef}>
          <button
            type="button"
            onClick={() => setShowFieldMenu(!showFieldMenu)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              showFieldMenu
                ? 'bg-[#017C87]/15 text-[#017C87]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Insert Dynamic Field"
          >
            <Code2 size={13} />
            <span>Fields</span>
            <ChevronDown size={11} />
          </button>

          {showFieldMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-gray-400 tracking-wider">
                Insert Dynamic Field
              </div>
              {DYNAMIC_FIELDS.map((f) => (
                <button
                  key={f.field}
                  onClick={() => insertField(f.field)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm text-gray-700">{f.label}</span>
                    <p className="text-[10px] text-gray-400">{f.description}</p>
                  </div>
                  <span className="text-[10px] text-[#017C87] font-mono bg-[#017C87]/5 px-1.5 py-0.5 rounded">
                    {'{' + f.field + '}'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor content — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Styles for the editor */}
      <style jsx global>{`
        .ProseMirror {
          min-height: 200px;
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.7;
          color: #1f2937;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: 700;
          margin: 1em 0 0.5em;
          line-height: 1.3;
        }
        .ProseMirror h2 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.8em 0 0.4em;
          line-height: 1.3;
        }
        .ProseMirror h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin: 0.6em 0 0.3em;
          line-height: 1.3;
        }
        .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #017C87;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #6b7280;
          font-style: italic;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1em 0;
        }
        .ProseMirror a {
          color: #017C87;
          text-decoration: underline;
        }
        .ProseMirror mark {
          border-radius: 2px;
          padding: 1px 2px;
        }
      `}</style>
    </div>
  );
}