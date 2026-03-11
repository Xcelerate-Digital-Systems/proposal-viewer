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
  Undo, Redo, Minus, Palette, Highlighter,
} from 'lucide-react';
import { DynamicFieldExtension } from './DynamicFieldExtension';
import { FontSizeExtension } from './FontSizeExtension';
import { FontWeightExtension } from './FontWeightExtension';
import ColorPickerDropdown from './ColorPickerDropdown';
import DynamicFieldMenu from './DynamicFieldMenu';
import './rich-text-editor.css';

/* ─── Constants ───────────────────────────────────────────────── */

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

/* ─── Toolbar primitives ──────────────────────────────────────── */

function ToolbarButton({
  onClick, isActive = false, disabled = false, title, children,
}: {
  onClick: () => void; isActive?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-[#017C87]/15 text-[#017C87]'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-gray-200 mx-1" />;
}

/* ─── Props ───────────────────────────────────────────────────── */

interface RichTextEditorProps {
  content: unknown;
  onUpdate: (content: unknown) => void;
  placeholder?: string;
}

/* ─── Component ───────────────────────────────────────────────── */

export default function RichTextEditor({ content, onUpdate, placeholder }: RichTextEditorProps) {
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [, setSelectionVersion] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing your content here...' }),
      TiptapUnderline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSizeExtension,
      FontWeightExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-[#017C87] underline' } }),
      DynamicFieldExtension,
    ],
    content: content as Record<string, unknown>,
    onUpdate: ({ editor: ed }) => onUpdate(ed.getJSON()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-gray-800',
      },
    },
  });

  // Update content from outside
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

  // Re-render on selection changes
  useEffect(() => {
    if (!editor) return;
    const handler = () => setSelectionVersion((v) => v + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

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

  const currentFontSize = editor.getAttributes('textStyle')?.fontSize?.replace('px', '') || '';
  const currentFontWeight = editor.getAttributes('textStyle')?.fontWeight || '';
  const currentTextColor = editor.getAttributes('textStyle')?.color || '';
  const currentHighlight = editor.getAttributes('highlight')?.color || '';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col max-h-[70vh]">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-1 px-2.5 py-2 bg-gray-50 border-b border-gray-200 z-10">
        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={16} />
        </ToolbarButton>

        <Separator />

        {/* Font size */}
        <input
          type="number"
          value={currentFontSize}
          min={6}
          max={96}
          placeholder="–"
          title="Font Size"
          onChange={(e) => {
            const val = e.target.value;
            if (val) editor.chain().focus().setFontSize(`${val}px`).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus(); } }}
          className="h-8 w-16 px-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded hover:border-gray-300 focus:outline-none focus:border-[#017C87] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        {/* Font weight */}
        <select
          value={currentFontWeight}
          onChange={(e) => {
            const val = e.target.value;
            if (val) editor.chain().focus().setFontWeight(val).run();
            else editor.chain().focus().unsetFontWeight().run();
          }}
          title="Font Weight"
          className="h-8 px-2 text-xs text-gray-600 bg-white border border-gray-200 rounded cursor-pointer hover:border-gray-300 focus:outline-none focus:border-[#017C87]"
          style={{ fontWeight: currentFontWeight ? Number(currentFontWeight) : undefined }}
        >
          <option value="">Weight</option>
          {FONT_WEIGHTS.map((w) => (
            <option key={w.value} value={w.value} style={{ fontWeight: Number(w.value) }}>{w.label}</option>
          ))}
        </select>

        <Separator />

        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
          <Underline size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={16} />
        </ToolbarButton>

        <Separator />

        {/* Text Color */}
        <ColorPickerDropdown
          title="Text Color"
          colors={TEXT_COLORS}
          currentColor={currentTextColor}
          columns={7}
          showCustomInput
          icon={<Palette size={16} />}
          isOpen={showTextColorPicker}
          onToggle={() => { setShowTextColorPicker(!showTextColorPicker); setShowHighlightPicker(false); }}
          onSelect={(color) => {
            if (color) editor.chain().focus().setColor(color).run();
            else editor.chain().focus().unsetColor().run();
          }}
          onClose={() => setShowTextColorPicker(false)}
        />

        {/* Highlight Color */}
        <ColorPickerDropdown
          title="Highlight"
          colors={HIGHLIGHT_COLORS}
          currentColor={currentHighlight}
          columns={5}
          icon={<Highlighter size={16} />}
          isOpen={showHighlightPicker}
          onToggle={() => { setShowHighlightPicker(!showHighlightPicker); setShowTextColorPicker(false); }}
          onSelect={(color) => {
            if (color) editor.chain().focus().toggleHighlight({ color }).run();
            else editor.chain().focus().unsetHighlight().run();
          }}
          onClose={() => setShowHighlightPicker(false)}
        />

        <Separator />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={16} />
        </ToolbarButton>

        <Separator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus size={16} />
        </ToolbarButton>

        <Separator />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight size={16} />
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
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded w-44 focus:outline-none focus:border-[#017C87]"
              autoFocus
            />
            <button onClick={setLink} className="text-xs px-2.5 py-1.5 bg-[#017C87] text-white rounded hover:bg-[#01434A]">Set</button>
            <button onClick={() => setShowLinkInput(false)} className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-gray-700">✕</button>
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
              <Link size={16} />
            </ToolbarButton>
            {editor.isActive('link') && (
              <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
                <Link2Off size={16} />
              </ToolbarButton>
            )}
          </>
        )}

        <Separator />

        {/* Dynamic fields */}
        <DynamicFieldMenu
          isOpen={showFieldMenu}
          onToggle={() => setShowFieldMenu(!showFieldMenu)}
          onClose={() => setShowFieldMenu(false)}
          onInsert={insertField}
        />
      </div>

      {/* Editor content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
