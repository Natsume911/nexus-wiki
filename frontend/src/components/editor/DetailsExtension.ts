import { Node, mergeAttributes } from '@tiptap/core';

// Expand/Collapse (Accordion) block — like Confluence expand macro
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    detailsBlock: {
      setDetails: () => ReturnType;
    };
  }
}

// Summary node (the clickable title)
export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes, { class: 'details-summary' }), 0];
  },
});

// Content node (the collapsible body)
export const DetailsContent = Node.create({
  name: 'detailsContent',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-details-content]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-details-content': '' }), 0];
  },
});

// Main details block
export const DetailsBlock = Node.create({
  name: 'detailsBlock',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  addAttributes() {
    return {
      open: { default: true, parseHTML: (el) => el.hasAttribute('open'), renderHTML: (attrs) => attrs.open ? { open: '' } : {} },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'details-block' }), 0];
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'Clicca per espandere' }] },
              { type: 'detailsContent', content: [{ type: 'paragraph' }] },
            ],
          }),
    };
  },
});
