'use client';

import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { useEffect, useRef } from 'react';
import MentionSuggestionList, { type MentionSuggestionListHandle } from './MentionSuggestionList';
import { useParticipants } from './useParticipants';
import type { Participant } from '@/lib/feedback/participants';

export interface MentionEditorHandle {
  /** Insert literal text at the current selection. Used for emoji picker. */
  insertText: (text: string) => void;
  /** Move focus into the editor. */
  focus: () => void;
}

interface MentionEditorProps {
  /** HTML content. The editor stays in sync via setContent when this prop changes externally. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** When true, Enter submits via onSubmit instead of inserting a newline. Shift+Enter still inserts a line break. */
  submitOnEnter?: boolean;
  onSubmit?: () => void;
  /** API endpoint that returns { participants: Participant[] } for the autocomplete. Null disables @-suggestions. */
  participantsUrl: string | null;
  /** CSS classes applied to the editor's ProseMirror root so the input matches the surrounding form's styling. */
  className?: string;
  /** Imperative handle so callers can insert text (e.g. emoji picker) without lifting state. */
  apiRef?: React.RefObject<MentionEditorHandle | null>;
}

/**
 * Reusable TipTap editor for comment surfaces. Keeps the input minimal —
 * paragraph + hard break + mentions — so it can stand in for plain
 * <textarea> / <input> without bringing along formatting toolbar surface.
 *
 * The editor outputs HTML through onChange so the caller can stash it on
 * the comment row. To inspect mentions for server-side notification routing
 * use `extractMentionsFromHtml` (see ./mention-html.ts).
 */
export default function MentionEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  submitOnEnter,
  onSubmit,
  participantsUrl,
  className,
  apiRef,
}: MentionEditorProps) {
  const { participantsRef, readyRef } = useParticipants(participantsUrl);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const editor = useEditor({
    extensions: [
      // Disable the formatting extensions we don't want in a comment box —
      // keeps StarterKit's doc/paragraph/text/hardBreak/history and drops
      // the rest. Headings, lists, blockquote, bold, etc. would invite
      // confusing rich-text editing on a chat-style input.
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Mention.configure({
        HTMLAttributes: {
          // Pill styling. Mirrors the styling used in MentionContent for
          // display so what you type matches what you see in the rendered
          // comment.
          class:
            'inline-flex items-center align-baseline px-1.5 py-0.5 rounded bg-teal/10 text-teal font-medium text-[12px] leading-none',
        },
        // The mention node carries { id, label } and renders as @{label} in
        // the editor. We override renderHTML so the data-* attrs we need on
        // the server (target email + display name) survive the round-trip.
        renderHTML({ options, node }) {
          const label = node.attrs.label ?? node.attrs.id ?? '';
          return [
            'span',
            {
              ...options.HTMLAttributes,
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': label,
            },
            `@${label}`,
          ];
        },
        suggestion: buildSuggestion(participantsRef, readyRef),
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          (className ?? '') +
          ' tiptap-mention-input focus:outline-none whitespace-pre-wrap break-words',
      },
      handleKeyDown(_view, event) {
        if (
          submitOnEnter &&
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          // Don't steal Enter while the suggestion popover is open — the
          // suggestion plugin handles it and inserts the picked mention.
          // ProseMirror runs plugin keydowns before this handler when the
          // suggestion is active, so we only get here when no popover is up.
          event.preventDefault();
          submitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      onChange(ed.isEmpty ? '' : ed.getHTML());
    },
    autofocus: autoFocus ?? false,
    immediatelyRender: false,
  });

  // Keep the editor in sync when the caller resets `value` to '' after a
  // successful submit. Don't push every external value change because that
  // would fight with each keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value === '' && current !== '') {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  // Expose imperative handle for callers that need to push text into the
  // editor without lifting state (emoji picker is the main case).
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = editor
      ? {
          insertText: (text: string) => editor.chain().focus().insertContent(text).run(),
          focus: () => editor.chain().focus().run(),
        }
      : null;
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef, editor]);

  return <EditorContent editor={editor} />;
}

// ─── Suggestion config (TipTap's mention popover plumbing) ──────────────

function buildSuggestion(
  participantsRef: { current: Participant[] },
  readyRef: { current: Promise<Participant[]> },
) {
  return {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }) => {
      if (participantsRef.current.length === 0) {
        const fetched = await readyRef.current;
        if (fetched.length > 0) participantsRef.current = fetched;
      }
      const q = query.trim().toLowerCase();
      const pool = participantsRef.current;
      if (!q) return pool.slice(0, 8);
      return pool
        .filter(
          (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
        )
        .slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<MentionSuggestionListHandle> | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart(props: SuggestionRenderProps) {
          component = new ReactRenderer(MentionSuggestionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;
          const [instance] = tippy('body', {
            getReferenceClientRect: () => props.clientRect!() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'light-border',
            arrow: false,
            offset: [0, 6],
          });
          popup = instance;
        },
        onUpdate(props: SuggestionRenderProps) {
          component?.updateProps(props);
          if (!props.clientRect || !popup) return;
          popup.setProps({
            getReferenceClientRect: () => props.clientRect!() ?? new DOMRect(),
          });
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

interface SuggestionRenderProps {
  editor: import('@tiptap/react').Editor;
  clientRect?: (() => DOMRect | null) | null;
  command: (item: Participant) => void;
  items: Participant[];
  query: string;
}
