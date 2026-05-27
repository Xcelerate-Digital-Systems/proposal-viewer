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
import { useEffect, useRef } from 'react';
import { DynamicFieldExtension } from './DynamicFieldExtension';
import { FontSizeExtension } from './FontSizeExtension';
import { FontWeightExtension } from './FontWeightExtension';
import RichTextToolbar from './RichTextToolbar';
import './rich-text-editor.css';

interface RichTextEditorProps {
  content: unknown;
  onUpdate: (content: unknown) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onUpdate, placeholder }: RichTextEditorProps) {
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
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-teal underline' } }),
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

  // Sync content from outside (e.g. page switch)
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

  if (!editor) return null;

  return (
    <div className="border border-edge-strong rounded-lg overflow-hidden bg-white flex flex-col max-h-[70vh]">
      <div className="shrink-0">
        <RichTextToolbar editor={editor} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
