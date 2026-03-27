interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

/**
 * Convert Markdown text to TipTap JSON document.
 * Handles: headings, paragraphs, bold, italic, code, links, lists, code blocks, blockquotes, HR, images.
 */
export function markdownToTiptap(md: string): TipTapNode {
  const lines = md.split('\n');
  const doc: TipTapNode = { type: 'doc', content: [] };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (fenced)
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      doc.content!.push({
        type: 'codeBlock',
        attrs: { language: lang || null },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      doc.content!.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      doc.content!.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      doc.content!.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInline(quoteLines.join(' ')) }],
      });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[-*+]\s/, '');
        // Task list item
        const taskMatch = text.match(/^\[([ xX])\]\s*(.*)/);
        if (taskMatch) {
          items.push({
            type: 'taskItem',
            attrs: { checked: taskMatch[1] !== ' ' },
            content: [{ type: 'paragraph', content: parseInline(taskMatch[2]) }],
          });
        } else {
          items.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: parseInline(text) }],
          });
        }
        i++;
      }
      // Check if it's a task list
      const isTaskList = items.every((it) => it.type === 'taskItem');
      doc.content!.push({
        type: isTaskList ? 'taskList' : 'bulletList',
        content: items,
      });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(text) }],
        });
        i++;
      }
      doc.content!.push({ type: 'orderedList', content: items });
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      doc.content!.push({
        type: 'image',
        attrs: { src: imgMatch[2], alt: imgMatch[1] },
      });
      i++;
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      doc.content!.push({
        type: 'paragraph',
        content: parseInline(paraLines.join(' ')),
      });
    }
  }

  return doc;
}

function isBlockStart(line: string): boolean {
  return (
    line.startsWith('#') ||
    line.startsWith('```') ||
    line.startsWith('> ') ||
    /^[-*+]\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^(-{3,}|_{3,}|\*{3,})$/.test(line.trim()) ||
    /^!\[/.test(line)
  );
}

function parseInline(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  // Regex to match inline patterns: bold, italic, code, links, strikethrough
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))|(~~(.+?)~~)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Bold **text**
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] });
    } else if (match[3]) {
      // Italic *text*
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'italic' }] });
    } else if (match[5]) {
      // Code `text`
      nodes.push({ type: 'text', text: match[6], marks: [{ type: 'code' }] });
    } else if (match[7]) {
      // Link [text](url)
      nodes.push({ type: 'text', text: match[8], marks: [{ type: 'link', attrs: { href: match[9] } }] });
    } else if (match[10]) {
      // Strikethrough ~~text~~
      nodes.push({ type: 'text', text: match[11], marks: [{ type: 'strike' }] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text: text || ' ' }];
}

/**
 * Extract title from markdown content.
 * Uses the first H1 heading, or the first line, or a default.
 */
export function extractTitle(md: string): string {
  const h1Match = md.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  const firstLine = md.split('\n').find((l) => l.trim() !== '');
  if (firstLine) return firstLine.replace(/^#+\s*/, '').trim().slice(0, 100);
  return 'Pagina importata';
}
