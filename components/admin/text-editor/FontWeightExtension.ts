// components/admin/text-editor/FontWeightExtension.ts
import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

export type FontWeightOptions = {
  types: string[];
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontWeight: {
      setFontWeight: (fontWeight: string) => ReturnType;
      unsetFontWeight: () => ReturnType;
    };
  }
}

export const FontWeightExtension = Extension.create<FontWeightOptions>({
  name: 'fontWeight',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      // Inline mark: applies font-weight to the <span> wrapping selected text
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => element.style.fontWeight || null,
            renderHTML: (attributes) => {
              if (!attributes.fontWeight) return {};
              return { style: `font-weight: ${attributes.fontWeight}` };
            },
          },
        },
      },
      // Node attribute: applies font-weight directly to <li> so ::marker inherits it
      {
        types: ['listItem'],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => element.style.fontWeight || null,
            renderHTML: (attributes) => {
              if (!attributes.fontWeight) return {};
              return { style: `font-weight: ${attributes.fontWeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontWeight:
        (fontWeight: string) =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontWeight })
            // Also stamp the attribute on any listItem nodes in the selection
            // so the <li> element itself carries the weight (enables ::marker inheritance)
            .updateAttributes('listItem', { fontWeight })
            .run();
        },
      unsetFontWeight:
        () =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontWeight: null })
            .removeEmptyTextStyle()
            .updateAttributes('listItem', { fontWeight: null })
            .run();
        },
    };
  },
});