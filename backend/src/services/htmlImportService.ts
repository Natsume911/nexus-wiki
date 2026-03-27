import * as cheerio from 'cheerio';

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

/**
 * Convert HTML string (from Google Docs, DOCX via mammoth, or any HTML source)
 * to TipTap JSON document.
 */
export function htmlToTiptapGeneric(html: string): TipTapNode {
  const $ = cheerio.load(html);
  const doc: TipTapNode = { type: 'doc', content: [] };

  // Process body children (or root if no body)
  const root = $('body').length ? $('body') : $.root();

  root.children().each((_, el) => {
    const node = convertElement($, $(el));
    if (node) {
      if (Array.isArray(node)) {
        doc.content!.push(...node);
      } else {
        doc.content!.push(node);
      }
    }
  });

  // If empty, add at least one paragraph
  if (doc.content!.length === 0) {
    doc.content!.push({ type: 'paragraph' });
  }

  return doc;
}

function convertElement($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): TipTapNode | TipTapNode[] | null {
  const tag = el.prop('tagName')?.toLowerCase();
  if (!tag) return null;

  // Text node
  if (el[0]?.type === 'text') {
    const text = el.text();
    if (!text.trim()) return null;
    return { type: 'text', text };
  }

  switch (tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return {
        type: 'heading',
        attrs: { level: parseInt(tag[1]) },
        content: convertInlineChildren($, el),
      };

    case 'p': {
      const content = convertInlineChildren($, el);
      if (content.length === 0) return null;
      return { type: 'paragraph', content };
    }

    case 'br':
      return { type: 'hardBreak' };

    case 'hr':
      return { type: 'horizontalRule' };

    case 'blockquote':
      return {
        type: 'blockquote',
        content: convertBlockChildren($, el),
      };

    case 'pre': {
      const code = el.find('code');
      const text = code.length ? code.text() : el.text();
      const lang = code.attr('class')?.replace('language-', '') || null;
      return {
        type: 'codeBlock',
        attrs: { language: lang },
        content: [{ type: 'text', text }],
      };
    }

    case 'ul':
      return {
        type: 'bulletList',
        content: el.children('li').map((_, li) => convertListItem($, $(li))).get().filter(Boolean) as TipTapNode[],
      };

    case 'ol':
      return {
        type: 'orderedList',
        content: el.children('li').map((_, li) => convertListItem($, $(li))).get().filter(Boolean) as TipTapNode[],
      };

    case 'table':
      return convertTable($, el);

    case 'img': {
      const src = el.attr('src') || '';
      const alt = el.attr('alt') || '';
      if (!src) return null;
      return {
        type: 'image',
        attrs: { src, alt, title: el.attr('title') || null },
      };
    }

    case 'div': case 'section': case 'article': case 'main': case 'span': {
      // Recurse into generic containers
      const children = convertBlockChildren($, el);
      return children.length > 0 ? children : null;
    }

    default: {
      // Try to get text content for unknown elements
      const text = el.text().trim();
      if (text) {
        return { type: 'paragraph', content: [{ type: 'text', text }] };
      }
      return null;
    }
  }
}

function convertListItem($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): TipTapNode {
  const content = convertBlockChildren($, el);
  // If no block children, wrap inline content in paragraph
  if (content.length === 0 || (content.length === 1 && content[0].type === 'text')) {
    return {
      type: 'listItem',
      content: [{ type: 'paragraph', content: convertInlineChildren($, el) }],
    };
  }
  return { type: 'listItem', content };
}

function convertTable($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): TipTapNode {
  const rows: TipTapNode[] = [];

  el.find('tr').each((rowIdx, tr) => {
    const cells: TipTapNode[] = [];
    $(tr).children('td, th').each((_, cell) => {
      const isHeader = cell.tagName === 'th' || rowIdx === 0;
      const colspan = parseInt($(cell).attr('colspan') || '1');
      const rowspan = parseInt($(cell).attr('rowspan') || '1');
      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        attrs: { colspan, rowspan, colwidth: null },
        content: [{ type: 'paragraph', content: convertInlineChildren($, $(cell)) }],
      });
    });

    if (cells.length > 0) {
      rows.push({ type: 'tableRow', content: cells });
    }
  });

  return { type: 'table', content: rows };
}

function convertBlockChildren($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): TipTapNode[] {
  const result: TipTapNode[] = [];
  el.children().each((_, child) => {
    const node = convertElement($, $(child));
    if (node) {
      if (Array.isArray(node)) {
        result.push(...node);
      } else {
        result.push(node);
      }
    }
  });
  return result;
}

function convertInlineChildren($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): TipTapNode[] {
  const result: TipTapNode[] = [];

  el.contents().each((_, child) => {
    if (child.type === 'text') {
      const text = $(child).text();
      if (text) result.push({ type: 'text', text });
      return;
    }

    const $child = $(child);
    const tag = child.tagName?.toLowerCase();

    if (!tag) return;

    // Inline marks
    const marks: TipTapNode['marks'] = [];
    const getMarks = ($el: cheerio.Cheerio<cheerio.Element>): TipTapNode['marks'] => {
      const m: NonNullable<TipTapNode['marks']> = [];
      const t = $el.prop('tagName')?.toLowerCase();
      if (t === 'strong' || t === 'b') m.push({ type: 'bold' });
      if (t === 'em' || t === 'i') m.push({ type: 'italic' });
      if (t === 'u') m.push({ type: 'underline' });
      if (t === 's' || t === 'strike' || t === 'del') m.push({ type: 'strike' });
      if (t === 'code') m.push({ type: 'code' });
      if (t === 'mark') m.push({ type: 'highlight' });
      if (t === 'a') {
        const href = $el.attr('href');
        if (href) m.push({ type: 'link', attrs: { href, target: '_blank' } });
      }
      // Check style for Google Docs bold/italic
      const style = $el.attr('style') || '';
      if (style.includes('font-weight') && (style.includes('700') || style.includes('bold'))) m.push({ type: 'bold' });
      if (style.includes('font-style') && style.includes('italic')) m.push({ type: 'italic' });
      if (style.includes('text-decoration') && style.includes('underline')) m.push({ type: 'underline' });
      return m;
    };

    const childMarks = getMarks($child);

    if (tag === 'br') {
      result.push({ type: 'hardBreak' });
      return;
    }

    if (tag === 'img') {
      const src = $child.attr('src');
      if (src) {
        result.push({ type: 'image', attrs: { src, alt: $child.attr('alt') || '' } });
      }
      return;
    }

    // Recursive inline: get text with marks
    const innerText = $child.text();
    if (innerText && childMarks.length > 0) {
      result.push({ type: 'text', text: innerText, marks: childMarks });
    } else if (innerText) {
      // Recurse for nested inline elements
      const inner = convertInlineChildren($, $child);
      // Apply parent marks to children
      if (childMarks.length > 0) {
        for (const n of inner) {
          if (n.type === 'text') {
            n.marks = [...(n.marks || []), ...childMarks];
          }
        }
      }
      result.push(...inner);
    }
  });

  return result;
}
