import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { ReactRenderer, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import { useI18nStore } from '@/i18n';
import { cn } from '@/lib/utils';
import { get } from '@/api/client';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      setMention: (attrs: { id: string; label: string }) => ReturnType;
    };
  }
}

interface UserItem {
  id: string;
  name: string | null;
  email: string;
}

function MentionNodeView(props: { node: { attrs: Record<string, unknown> } }) {
  const label = (props.node.attrs.label as string) || '';
  return (
    <NodeViewWrapper as="span" className="inline">
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent/15 text-accent text-sm font-medium cursor-default">
        @{label}
      </span>
    </NodeViewWrapper>
  );
}

interface MentionListProps {
  items: UserItem[];
  command: (item: UserItem) => void;
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
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
    return <div className="p-3 text-sm text-text-muted">{useI18nStore.getState().t('mention.noUsers')}</div>;
  }

  return (
    <div className="w-56 max-h-60 overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-1">
      {items.map((item, i) => (
        <button
          key={item.id}
          onClick={() => selectItem(i)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
            i === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
          )}
        >
          <div className="h-6 w-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">
            {(item.name || item.email)[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{item.name || item.email}</p>
            {item.name && <p className="text-xs text-text-muted truncate">{item.email}</p>}
          </div>
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = 'MentionList';

// Cache users list
let usersCache: UserItem[] | null = null;

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-mention': '', class: 'mention' }), `@${HTMLAttributes.label}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView);
  },

  addCommands() {
    return {
      setMention:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('mention'),
        editor: this.editor,
        char: '@',
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).insertContent({
            type: 'mention',
            attrs: { id: props.id, label: props.name || props.email },
          }).run();
        },
        items: async ({ query }: { query: string }) => {
          if (!usersCache) {
            try {
              usersCache = (await get('/users/all')) as UserItem[];
            } catch {
              usersCache = [];
            }
          }
          const q = query.toLowerCase();
          return usersCache
            .filter((u) => (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
            .slice(0, 8);
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(MentionList, { props, editor: props.editor });
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
