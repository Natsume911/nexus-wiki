import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { useT } from '@/i18n';

// === Heading ID Extension ===
// Adds stable `id` attributes to heading DOM elements based on text + occurrence index

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'heading';
}

const headingIdPluginKey = new PluginKey('headingIds');

export const HeadingIdExtension = Extension.create({
  name: 'headingIds',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: headingIdPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const slugCounts = new Map<string, number>();

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'heading') {
                const baseSlug = slugifyHeading(node.textContent);
                const count = slugCounts.get(baseSlug) || 0;
                slugCounts.set(baseSlug, count + 1);
                const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, { id }),
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// === Types ===

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      setTableOfContents: () => ReturnType;
    };
  }
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// === Extract headings from editor ===

function extractHeadings(editor: Editor): TocItem[] {
  const headings: TocItem[] = [];
  const slugCounts = new Map<string, number>();

  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') {
      const text = node.textContent;
      const baseSlug = slugifyHeading(text);
      const count = slugCounts.get(baseSlug) || 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

      headings.push({
        id,
        text,
        level: node.attrs.level as number,
      });
    }
  });

  return headings;
}

// === In-editor TOC block (insertable via slash command) ===

function TocNodeView(props: { editor: Editor }) {
  const { editor } = props;
  const t = useT();
  const [headings, setHeadings] = useState<TocItem[]>([]);

  const update = useCallback(() => {
    if (editor) setHeadings(extractHeadings(editor));
  }, [editor]);

  useEffect(() => {
    update();
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor, update]);

  const scrollToHeading = useCallback((id: string) => {
    const el = editor.view.dom.closest('.ProseMirror')?.querySelector(`[id="${id}"]`)
      || document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editor]);

  return (
    <NodeViewWrapper>
      <div className="border border-border-primary rounded-lg p-4 my-4 bg-bg-secondary/50" contentEditable={false}>
        <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">{t('toc.title')}</h4>
        {headings.length === 0 ? (
          <p className="text-sm text-text-muted">{t('toc.empty')}</p>
        ) : (
          <nav className="space-y-1">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className="block text-sm text-text-secondary hover:text-accent transition-colors"
                style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToHeading(h.id);
                }}
              >
                {h.text || 'Titolo vuoto'}
              </a>
            ))}
          </nav>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': '' }), 'Table of Contents'];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocNodeView);
  },

  addCommands() {
    return {
      setTableOfContents: () => ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },
});

// === Floating TOC sidebar (right panel) ===

export function FloatingToc({ editor }: { editor: Editor | null }) {
  const t = useT();
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headingElsRef = useRef<Map<string, Element>>(new Map());

  // Extract headings on editor update
  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const h = extractHeadings(editor);
      setHeadings(h);
    };

    update();
    editor.on('update', update);
    return () => { editor.off('update', update); };
  }, [editor]);

  // Track active heading with IntersectionObserver
  useEffect(() => {
    if (!editor || headings.length === 0) return;

    // Small delay to let ProseMirror decorations apply IDs to DOM
    const timeout = setTimeout(() => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      headingElsRef.current.clear();

      const editorDom = editor.view.dom;
      const visibleHeadings = new Set<string>();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.id;
            if (entry.isIntersecting) {
              visibleHeadings.add(id);
            } else {
              visibleHeadings.delete(id);
            }
          }

          // Pick the first visible heading in document order
          if (visibleHeadings.size > 0) {
            for (const h of headings) {
              if (visibleHeadings.has(h.id)) {
                setActiveId(h.id);
                break;
              }
            }
          }
        },
        {
          rootMargin: '-10% 0px -70% 0px',
          threshold: 0,
        },
      );

      // Observe heading elements
      for (const h of headings) {
        const el = editorDom.querySelector(`[id="${h.id}"]`);
        if (el) {
          headingElsRef.current.set(h.id, el);
          observerRef.current.observe(el);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [editor, headings]);

  const scrollToHeading = useCallback((id: string) => {
    const el = headingElsRef.current.get(id) || document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  if (headings.length < 2) return null;

  return (
    <nav className="space-y-1">
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{t('toc.title')}</h4>
      {headings.map((h) => (
        <button
          key={h.id}
          className={`block text-xs w-full text-left transition-colors rounded px-1.5 py-0.5 ${
            activeId === h.id
              ? 'text-accent font-medium bg-accent/10'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          style={{ paddingLeft: `${(h.level - 1) * 12 + 6}px` }}
          onClick={() => scrollToHeading(h.id)}
        >
          {h.text || 'Titolo vuoto'}
        </button>
      ))}
    </nav>
  );
}
