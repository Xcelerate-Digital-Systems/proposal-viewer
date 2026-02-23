// components/admin/text-editor/RichTextEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TiptapLink from '@tiptap/extension-link';
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, Link, Link2Off,
  Undo, Redo, Code2, ChevronDown, Minus,
} from 'lucide-react';
import { DynamicFieldExtension, DYNAMIC_FIELDS } from './DynamicFieldExtension';

interface RichTextEditorProps {
  content: unknown; // TipTap JSON
  onUpdate: (content: unknown) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onUpdate, placeholder }: RichTextEditorProps) {
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fieldMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your content here...',
      }),
      TiptapUnderline,
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

  // Close field menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(e.target as Node)) {
        setShowFieldMenu(false);
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
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={14} />
        </ToolbarButton>

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

      {/* Editor content */}
      <EditorContent editor={editor} />

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
      `}</style>
    </div>
  );
}