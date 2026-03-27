import { Node, mergeAttributes } from '@tiptap/core';

// Multi-column layout block — like Confluence layout macro
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count?: number) => ReturnType;
    };
  }
}

// Single column inside a columns block
export const Column = Node.create({
  name: 'column',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'column' }), 0];
  },
});

// Columns container
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,4}',
  defining: true,

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (el) => parseInt(el.getAttribute('data-columns') || '2', 10),
        renderHTML: (attrs) => ({ 'data-columns': attrs.count }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-columns]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'columns-block' }), 0];
  },

  addCommands() {
    return {
      setColumns:
        (count = 2) =>
        ({ commands }) => {
          const cols = Array.from({ length: count }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }],
          }));
          return commands.insertContent({
            type: this.name,
            attrs: { count },
            content: cols,
          });
        },
    };
  },
});
