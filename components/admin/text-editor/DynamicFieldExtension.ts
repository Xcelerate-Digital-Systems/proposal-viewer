// components/admin/text-editor/DynamicFieldExtension.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DynamicFieldNodeView from './DynamicFieldNodeView';

export interface DynamicFieldOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dynamicField: {
      insertDynamicField: (field: string) => ReturnType;
    };
  }
}

export const DynamicFieldExtension = Node.create<DynamicFieldOptions>({
  name: 'dynamicField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      field: {
        default: 'client_name',
        parseHTML: (element) => element.getAttribute('data-field'),
        renderHTML: (attributes) => ({ 'data-field': attributes.field }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="dynamic-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
      { 'data-type': 'dynamic-field' }
    )];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DynamicFieldNodeView);
  },

  addCommands() {
    return {
      insertDynamicField:
        (field: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { field },
          });
        },
    };
  },
});

// Available dynamic fields
export const DYNAMIC_FIELDS = [
  { field: 'client_name', label: 'Client Name', description: 'The proposal recipient' },
  { field: 'company_name', label: 'Company Name', description: 'Your agency name' },
  { field: 'user_name', label: 'User Name', description: 'The proposal creator' },
  { field: 'proposal_title', label: 'Proposal Title', description: 'The proposal name' },
  { field: 'date', label: 'Current Date', description: "Today's date" },
] as const;

export type DynamicFieldType = typeof DYNAMIC_FIELDS[number]['field'];

// Resolve a dynamic field to its actual value
export function resolveDynamicField(
  field: string,
  context: {
    clientName?: string;
    companyName?: string;
    userName?: string;
    proposalTitle?: string;
  }
): string {
  switch (field) {
    case 'client_name':
      return context.clientName || '[Client Name]';
    case 'company_name':
      return context.companyName || '[Company Name]';
    case 'user_name':
      return context.userName || '[User Name]';
    case 'proposal_title':
      return context.proposalTitle || '[Proposal Title]';
    case 'date':
      return new Date().toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    default:
      return `[${field}]`;
  }
}