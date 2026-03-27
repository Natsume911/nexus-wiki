import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import { useI18nStore } from '@/i18n';
import { cn } from '@/lib/utils';

// Common emoji list for quick access
const EMOJI_LIST = [
  { emoji: '\u{1F44D}', name: 'thumbsup', keywords: 'like ok good thumbs up' },
  { emoji: '\u{1F44E}', name: 'thumbsdown', keywords: 'dislike bad thumbs down' },
  { emoji: '\u{2705}', name: 'check', keywords: 'done complete yes check' },
  { emoji: '\u{274C}', name: 'cross', keywords: 'no wrong error cross' },
  { emoji: '\u{26A0}\u{FE0F}', name: 'warning', keywords: 'warning caution alert' },
  { emoji: '\u{2139}\u{FE0F}', name: 'info', keywords: 'info information' },
  { emoji: '\u{1F525}', name: 'fire', keywords: 'fire hot popular' },
  { emoji: '\u{1F680}', name: 'rocket', keywords: 'rocket launch deploy' },
  { emoji: '\u{1F41B}', name: 'bug', keywords: 'bug insect error' },
  { emoji: '\u{1F4A1}', name: 'bulb', keywords: 'idea light bulb tip' },
  { emoji: '\u{1F389}', name: 'party', keywords: 'party celebration tada' },
  { emoji: '\u{1F4DD}', name: 'memo', keywords: 'memo note write' },
  { emoji: '\u{1F512}', name: 'lock', keywords: 'lock security private' },
  { emoji: '\u{1F513}', name: 'unlock', keywords: 'unlock open public' },
  { emoji: '\u{2B50}', name: 'star', keywords: 'star favorite important' },
  { emoji: '\u{1F4CC}', name: 'pin', keywords: 'pin pushpin important' },
  { emoji: '\u{1F4E2}', name: 'megaphone', keywords: 'announce megaphone alert' },
  { emoji: '\u{23F0}', name: 'alarm', keywords: 'alarm clock time deadline' },
  { emoji: '\u{1F6A7}', name: 'construction', keywords: 'construction wip work in progress' },
  { emoji: '\u{1F914}', name: 'thinking', keywords: 'thinking question hmm' },
  { emoji: '\u{1F4C5}', name: 'calendar', keywords: 'calendar date schedule' },
  { emoji: '\u{1F465}', name: 'people', keywords: 'people team group' },
  { emoji: '\u{1F3AF}', name: 'target', keywords: 'target goal objective' },
  { emoji: '\u{1F4CA}', name: 'chart', keywords: 'chart graph statistics data' },
];

interface EmojiItem {
  emoji: string;
  name: string;
  keywords: string;
}

interface EmojiListProps {
  items: EmojiItem[];
  command: (item: EmojiItem) => void;
}

interface EmojiListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const EmojiList = forwardRef<EmojiListRef, EmojiListProps>(({ items, command }, ref) => {
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
    return <div className="p-3 text-sm text-text-muted">{useI18nStore.getState().t('emoji.noResults')}</div>;
  }

  return (
    <div className="w-56 max-h-60 overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-1">
      {items.map((item, i) => (
        <button
          key={item.name}
          onClick={() => selectItem(i)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-left text-sm transition-colors',
            i === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
          )}
        >
          <span className="text-lg">{item.emoji}</span>
          <span className="truncate">:{item.name}:</span>
        </button>
      ))}
    </div>
  );
});
EmojiList.displayName = 'EmojiList';

export const EmojiExtension = Extension.create({
  name: 'emoji',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('emoji'),
        editor: this.editor,
        char: ':',
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).insertContent(props.emoji).run();
        },
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return EMOJI_LIST.filter(
            (e) => e.name.includes(q) || e.keywords.includes(q),
          ).slice(0, 12);
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(EmojiList, { props, editor: props.editor });
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
