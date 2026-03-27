import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Code, Quote, Table, Image, Minus, AlertCircle, Columns2, ChevronDown,
  Layers, GitBranch, Sigma, Badge, BookOpen, Video, Mic, Sparkles, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT, useI18nStore } from '@/i18n';
import type { ReactNode } from 'react';
import type { TranslationKey } from '@/i18n/types';

type SlashCategory = 'text' | 'blocks' | 'media' | 'advanced' | 'ai';

interface SlashCommandItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: ReactNode;
  category: SlashCategory;
  command: (props: { editor: any; range: any }) => void;
}

const CATEGORY_LABELS: Record<SlashCategory, TranslationKey> = {
  text: 'editor.slashCat.text' as TranslationKey,
  blocks: 'editor.slashCat.blocks' as TranslationKey,
  media: 'editor.slashCat.media' as TranslationKey,
  advanced: 'editor.slashCat.advanced' as TranslationKey,
  ai: 'editor.slashCat.ai' as TranslationKey,
};

const slashItems: SlashCommandItem[] = [
  {
    titleKey: 'editor.slash.text' as const,
    descKey: 'editor.slash.textDesc' as const,
    icon: <Type className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    titleKey: 'editor.slash.heading1' as const,
    descKey: 'editor.slash.heading1Desc' as const,
    icon: <Heading1 className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    titleKey: 'editor.slash.heading2' as const,
    descKey: 'editor.slash.heading2Desc' as const,
    icon: <Heading2 className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    titleKey: 'editor.slash.heading3' as const,
    descKey: 'editor.slash.heading3Desc' as const,
    icon: <Heading3 className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    titleKey: 'editor.slash.bulletList' as const,
    descKey: 'editor.slash.bulletListDesc' as const,
    icon: <List className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    titleKey: 'editor.slash.orderedList' as const,
    descKey: 'editor.slash.orderedListDesc' as const,
    icon: <ListOrdered className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    titleKey: 'editor.slash.taskList' as const,
    descKey: 'editor.slash.taskListDesc' as const,
    icon: <CheckSquare className="h-4 w-4" />,
    category: 'text',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    titleKey: 'editor.slash.codeBlock' as const,
    descKey: 'editor.slash.codeBlockDesc' as const,
    icon: <Code className="h-4 w-4" />,
    category: 'blocks',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    titleKey: 'editor.slash.quote' as const,
    descKey: 'editor.slash.quoteDesc' as const,
    icon: <Quote className="h-4 w-4" />,
    category: 'blocks',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    titleKey: 'editor.slash.table' as const,
    descKey: 'editor.slash.tableDesc' as const,
    icon: <Table className="h-4 w-4" />,
    category: 'blocks',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    titleKey: 'editor.slash.image' as const,
    descKey: 'editor.slash.imageDesc' as const,
    icon: <Image className="h-4 w-4" />,
    category: 'media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('nexus:open-file-picker', { detail: { accept: 'image/*' } }));
    },
  },
  {
    titleKey: 'editor.slash.attachment' as const,
    descKey: 'editor.slash.attachmentDesc' as const,
    icon: <Paperclip className="h-4 w-4" />,
    category: 'media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('nexus:open-file-picker'));
    },
  },
  {
    titleKey: 'editor.slash.video' as const,
    descKey: 'editor.slash.videoDesc' as const,
    icon: <Video className="h-4 w-4" />,
    category: 'media',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setVideoEmbed().run(),
  },
  {
    titleKey: 'editor.slash.divider' as const,
    descKey: 'editor.slash.dividerDesc' as const,
    icon: <Minus className="h-4 w-4" />,
    category: 'blocks',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    titleKey: 'editor.slash.callout' as const,
    descKey: 'editor.slash.calloutDesc' as const,
    icon: <AlertCircle className="h-4 w-4" />,
    category: 'blocks',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout('info').run(),
  },
  {
    titleKey: 'editor.slash.columns' as const,
    descKey: 'editor.slash.columnsDesc' as const,
    icon: <Columns2 className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setColumns(2).run(),
  },
  {
    titleKey: 'editor.slash.expand' as const,
    descKey: 'editor.slash.expandDesc' as const,
    icon: <ChevronDown className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setDetails().run(),
  },
  {
    titleKey: 'editor.slash.tabs' as const,
    descKey: 'editor.slash.tabsDesc' as const,
    icon: <Layers className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setTabGroup().run(),
  },
  {
    titleKey: 'editor.slash.mermaid' as const,
    descKey: 'editor.slash.mermaidDesc' as const,
    icon: <GitBranch className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setMermaidBlock().run(),
  },
  {
    titleKey: 'editor.slash.math' as const,
    descKey: 'editor.slash.mathDesc' as const,
    icon: <Sigma className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setMathBlock().run(),
  },
  {
    titleKey: 'editor.slash.badge' as const,
    descKey: 'editor.slash.badgeDesc' as const,
    icon: <Badge className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setStatusBadge('TODO', 'grey').run();
    },
  },
  {
    titleKey: 'editor.slash.toc' as const,
    descKey: 'editor.slash.tocDesc' as const,
    icon: <BookOpen className="h-4 w-4" />,
    category: 'advanced',
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setTableOfContents().run(),
  },
  {
    titleKey: 'editor.slash.meeting' as const,
    descKey: 'editor.slash.meetingDesc' as const,
    icon: <Mic className="h-4 w-4" />,
    category: 'ai',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('nexus:open-meeting-recorder'));
    },
  },
  {
    titleKey: 'editor.slash.aiContinue' as const,
    descKey: 'editor.slash.aiContinueDesc' as const,
    icon: <Sparkles className="h-4 w-4" />,
    category: 'ai',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('nexus:ai-continue-writing', {
        detail: { editor },
      }));
    },
  },
];

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const t = useT();

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

    const selectedBtnRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
      selectedBtnRef.current?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (!items.length) {
      return (
        <div className="w-72 rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-3">
          <div className="text-sm text-text-muted">{t('editor.slash.noResults')}</div>
        </div>
      );
    }

    const categoryOrder: SlashCategory[] = ['text', 'blocks', 'media', 'advanced', 'ai'];
    const grouped = new Map<SlashCategory, { item: SlashCommandItem; idx: number }[]>();
    items.forEach((item, i) => {
      const cat = item.category || 'blocks';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push({ item, idx: i });
    });

    return (
      <div className="w-72 max-h-80 overflow-y-auto rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-1" role="listbox">
        {categoryOrder.map(cat => {
          const group = grouped.get(cat);
          if (!group?.length) return null;
          return (
            <div key={cat}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {t(CATEGORY_LABELS[cat])}
              </div>
              {group.map(({ item, idx }) => (
                <button
                  key={item.titleKey}
                  ref={idx === selectedIndex ? selectedBtnRef : undefined}
                  onClick={() => selectItem(idx)}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-1.5 rounded-lg text-left transition-colors text-sm',
                    idx === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  <div className="flex items-center justify-center h-7 w-7 rounded-md bg-bg-tertiary text-text-muted shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs">{t(item.titleKey)}</div>
                    <div className="text-[10px] text-text-muted truncate">{t(item.descKey)}</div>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    );
  },
);
SlashCommandList.displayName = 'SlashCommandList';

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('slashCommand'),
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }) => {
          const t = useI18nStore.getState().t;
          return slashItems.filter((item) =>
            t(item.titleKey).toLowerCase().includes(query.toLowerCase()),
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList, {
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
