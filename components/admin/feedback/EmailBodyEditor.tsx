'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapLink from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';
import {
  Bold, Italic, List, ListOrdered, Link, Link2Off,
  Undo, Redo,
} from 'lucide-react';

interface EmailBodyEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export default function EmailBodyEditor({
  content,
  onChange,
  placeholder = 'The main email body copy…',
  className,
}: EmailBodyEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-teal underline' },
      }),
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2 text-sm text-ink',
      },
      transformPastedHTML(html: string) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
        doc.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
        return doc.body.innerHTML;
      },
    },
  });

  const isInternalUpdate = useRef(false);
  const handleUpdate = ({ editor: ed }: { editor: typeof editor }) => {
    if (!ed) return;
    isInternalUpdate.current = true;
    const html = ed.getHTML();
    onChange(ed.isEmpty ? '' : html);
  };

  useEffect(() => {
    if (!editor) return;
    editor.on('update', handleUpdate);
    return () => { editor.off('update', handleUpdate); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const currentHtml = editor.getHTML();
    if (currentHtml !== content) {
      editor.commands.setContent(content || '');
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className={`border border-edge-strong rounded-2xl overflow-hidden bg-surface ${className ?? ''}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white/50 border-b border-edge">
        <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={14} />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={14} />
        </TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={14} />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={14} />
        </TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List size={14} />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered size={14} />
        </TBtn>
        <Sep />
        <LinkButton editor={editor} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function TBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-teal/15 text-teal' : 'text-dim hover:text-prose hover:bg-surface'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-edge mx-0.5" />;
}

function LinkButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const isActive = editor.isActive('link');

  if (isActive) {
    return (
      <TBtn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
        <Link2Off size={14} />
      </TBtn>
    );
  }

  return (
    <TBtn
      onClick={() => {
        const url = window.prompt('URL:');
        if (url) {
          const href = url.startsWith('http') ? url : `https://${url}`;
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        }
      }}
      title="Insert Link"
    >
      <Link size={14} />
    </TBtn>
  );
}
