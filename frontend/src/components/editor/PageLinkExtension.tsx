import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useI18nStore } from '@/i18n';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPages } from '@/api/search';

interface PageLinkItem {
  id: string;
  title: string;
  slug: string;
  space: { slug: string };
}

function PageLinkNodeView(props: { node: { attrs: Record<string, unknown> } }) {
  const { href, title } = props.node.attrs as { href: string; title: string };
  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href={href}
        className="inline-flex items-center gap-1 text-accent hover:text-accent-hover underline decoration-accent/30 hover:decoration-accent transition-colors"
      >
        <FileText className="h-3.5 w-3.5 inline" />
        {title}
      </a>
    </NodeViewWrapper>
  );
}

interface PageLinkListProps {
  items: PageLinkItem[];
  command: (item: PageLinkItem) => void;
}

interface PageLinkListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const PageLinkList = forwardRef<PageLinkListRef, PageLinkListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return <div className="p-3 text-sm text-text-muted">{useI18nStore.getState().t('pageLink.noPages')}</div>;
    }

    return (
      <div className="w-64 max-h-60 overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-1">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => selectItem(i)}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
              i === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
            )}
          >
            <FileText className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  },
);
PageLinkList.displayName = 'PageLinkList';

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: { default: null },
      title: { default: null },
      pageId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-page-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-page-link': '' }), HTMLAttributes.title || ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkNodeView);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('pageLink'),
        editor: this.editor,
        char: '[[',
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).insertContent({
            type: 'pageLink',
            attrs: {
              href: `/wiki/${props.space.slug}/${props.slug}`,
              title: props.title,
              pageId: props.id,
            },
          }).run();
        },
        items: async ({ query }: { query: string }) => {
          if (!query) return [];
          try {
            return await searchPages(query);
          } catch {
            return [];
          }
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(PageLinkList, {
                props,
                editor: props.editor,
              });

              popup = document.createElement('div');
              popup.style.position = 'absolute';
              popup.style.zIndex = '50';
              popup.appendChild(component.element);
              document.body.appendChild(popup);

              const rect = props.clientRect?.();
              if (rect && popup) {
                popup.style.left = `${rect.left}px`;
                popup.style.top = `${rect.bottom + 4}px`;
              }
            },
            onUpdate: (props: any) => {
              component?.updateProps(props);
              const rect = props.clientRect?.();
              if (rect && popup) {
                popup.style.left = `${rect.left}px`;
                popup.style.top = `${rect.bottom + 4}px`;
              }
            },
            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup?.remove();
                component?.destroy();
                return true;
              }
              return (component?.ref as any)?.onKeyDown?.(props) ?? false;
            },
            onExit: () => {
              popup?.remove();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
