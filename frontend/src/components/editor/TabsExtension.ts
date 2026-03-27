import { Node, mergeAttributes } from '@tiptap/core';

// Tab group block — like Wiki.js tabsets
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabGroup: {
      setTabGroup: () => ReturnType;
    };
  }
}

export const TabItem = Node.create({
  name: 'tabItem',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: 'Tab',
        parseHTML: (el) => el.getAttribute('data-tab-title') || 'Tab',
        renderHTML: (attrs) => ({ 'data-tab-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-tab-item]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-tab-item': '', class: 'tab-item' }), 0];
  },
});

export const TabGroup = Node.create({
  name: 'tabGroup',
  group: 'block',
  content: 'tabItem{2,6}',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-tab-group]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-tab-group': '', class: 'tab-group' }), 0];
  },

  addCommands() {
    return {
      setTabGroup:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              { type: 'tabItem', attrs: { title: 'Tab 1' }, content: [{ type: 'paragraph' }] },
              { type: 'tabItem', attrs: { title: 'Tab 2' }, content: [{ type: 'paragraph' }] },
            ],
          }),
    };
  },
});
