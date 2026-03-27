import { useState, useEffect, useMemo, useCallback } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsSidebarProps {
  content: Record<string, unknown>;
}

function extractHeadings(doc: Record<string, unknown>): TocItem[] {
  const items: TocItem[] = [];
  const content = (doc as { content?: { type?: string; attrs?: { level?: number }; content?: { text?: string }[] }[] }).content;
  if (!content) return items;

  for (const node of content) {
    if (node.type === 'heading' && node.attrs?.level && node.content) {
      const text = node.content.map(n => n.text || '').join('');
      if (text.trim()) {
        items.push({
          id: text.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi, '-').replace(/^-|-$/g, ''),
          text: text.trim(),
          level: node.attrs.level,
        });
      }
    }
  }
  return items;
}

export function TableOfContentsSidebar({ content }: TableOfContentsSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const headings = useMemo(() => extractHeadings(content), [content]);
  const minLevel = useMemo(() => Math.min(...headings.map(h => h.level), 6), [headings]);

  // Hide if page already has an inline TableOfContents node (search recursively)
  const hasInlineToc = useMemo(() => {
    const findToc = (node: unknown): boolean => {
      if (!node || typeof node !== 'object') return false;
      const n = node as { type?: string; content?: unknown[] };
      if (n.type === 'tableOfContents' || n.type === 'toc') return true;
      return n.content?.some(findToc) ?? false;
    };
    return findToc(content);
  }, [content]);

  // Track which heading is in view
  const handleScroll = useCallback(() => {
    const editorEl = document.querySelector('.tiptap.ProseMirror');
    if (!editorEl) return;

    const headingEls = editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let current: string | null = null;

    for (const el of Array.from(headingEls)) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 120) {
        const text = el.textContent?.trim() || '';
        const id = text.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi, '-').replace(/^-|-$/g, '');
        current = id;
      }
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToHeading = (item: TocItem) => {
    const editorEl = document.querySelector('.tiptap.ProseMirror');
    if (!editorEl) return;

    const headingEls = editorEl.querySelectorAll(`h${item.level}`);
    for (const el of Array.from(headingEls)) {
      if (el.textContent?.trim() === item.text) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  // Don't show if page has inline TOC or too few headings
  if (headings.length < 3 || hasInlineToc) return null;

  return (
    <div className="hidden 2xl:block fixed right-4 top-28 w-48 max-h-[calc(100vh-8rem)] z-10 opacity-70 hover:opacity-100 transition-opacity">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 hover:text-text-primary transition-colors"
      >
        <List className="h-3.5 w-3.5" />
        Contenuti
      </button>

      {!collapsed && (
        <nav className="overflow-y-auto max-h-[calc(100vh-10rem)] pr-2 space-y-0.5 border-l border-border-primary">
          {headings.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              onClick={() => scrollToHeading(item)}
              className={cn(
                'block w-full text-left text-xs leading-snug py-1 transition-colors truncate',
                activeId === item.id
                  ? 'text-accent font-medium border-l-2 border-accent -ml-px'
                  : 'text-text-muted hover:text-text-secondary border-l-2 border-transparent -ml-px',
              )}
              style={{ paddingLeft: `${(item.level - minLevel) * 12 + 12}px` }}
              title={item.text}
            >
              {item.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
