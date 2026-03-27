import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import AdmZip from 'adm-zip';
import path from 'path';

export interface ParsedPage {
  title: string;
  html: string;
  parentTitle: string | null;
  attachments: string[];  // filenames referenced in HTML
  order: number;
}

export interface FileEntry {
  filename: string;
  buffer: Buffer;
}

export interface ParseResult {
  pages: ParsedPage[];
  attachments: FileEntry[];
}

/**
 * Parse a Confluence HTML export ZIP file.
 */
export function parseConfluenceZip(buffer: Buffer): ParseResult {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const htmlFiles = new Map<string, string>();
  const attachmentFiles: FileEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;

    if (name.match(/\.(png|jpg|jpeg|gif|svg|webp|pdf|docx?|xlsx?|pptx?|zip|tar|gz|mp4|mov)$/i)) {
      attachmentFiles.push({
        filename: path.basename(name),
        buffer: entry.getData(),
      });
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      htmlFiles.set(name, entry.getData().toString('utf-8'));
    }
  }

  // Try to extract hierarchy from index.html
  const hierarchy = new Map<string, string | null>();
  const indexHtml = htmlFiles.get('index.html') || htmlFiles.get('Index.html');

  if (indexHtml) {
    const $ = load(indexHtml);
    function walkList(el: any, parentTitle: string | null) {
      el.children('li').each((_i: number, li: any) => {
        const $li = $(li);
        const link = $li.children('a').first();
        const title = link.text().trim();
        if (title) {
          hierarchy.set(title, parentTitle);
          const subList = $li.children('ul, ol').first();
          if (subList.length) {
            walkList(subList, title);
          }
        }
      });
    }
    $('ul, ol').each((_i: number, list: any) => {
      if ($(list).parent().is('body, div, main, .content')) {
        walkList($(list), null);
      }
    });
  }

  // Parse each HTML page
  const pages: ParsedPage[] = [];
  let order = 0;

  for (const [filename, html] of htmlFiles) {
    if (filename === 'index.html' || filename === 'Index.html') continue;

    const $ = load(html);
    const title = $('title').text().trim()
      || $('h1').first().text().trim()
      || path.basename(filename, path.extname(filename)).replace(/_/g, ' ');

    const referencedAttachments: string[] = [];
    $('img').each((_i: number, img: any) => {
      const src = $(img).attr('src');
      if (src) referencedAttachments.push(path.basename(src));
    });

    const body = $('body').length ? $('body').html() || '' : html;

    pages.push({
      title,
      html: body,
      parentTitle: hierarchy.get(title) ?? null,
      attachments: referencedAttachments,
      order: order++,
    });
  }

  return { pages, attachments: attachmentFiles };
}

/**
 * Convert Confluence HTML to TipTap JSON document structure.
 */
export function htmlToTiptap(html: string): Record<string, unknown> {
  const $ = load(html, { xmlMode: false } as any);
  const content: Record<string, unknown>[] = [];

  function processInline(el: any): Record<string, unknown>[] {
    const nodes: Record<string, unknown>[] = [];

    el.contents().each((_i: number, node: any) => {
      if (node.type === 'text') {
        const text = node.data;
        if (text) nodes.push({ type: 'text', text });
        return;
      }

      const $el = $(node);
      const tag = node.tagName?.toLowerCase();

      if (!tag) return;

      if (tag === 'strong' || tag === 'b') {
        const inner = processInline($el);
        for (const n of inner) {
          const marks = ((n.marks as any[]) || []);
          marks.push({ type: 'bold' });
          n.marks = marks;
          nodes.push(n);
        }
      } else if (tag === 'em' || tag === 'i') {
        const inner = processInline($el);
        for (const n of inner) {
          const marks = ((n.marks as any[]) || []);
          marks.push({ type: 'italic' });
          n.marks = marks;
          nodes.push(n);
        }
      } else if (tag === 'u') {
        const inner = processInline($el);
        for (const n of inner) {
          const marks = ((n.marks as any[]) || []);
          marks.push({ type: 'underline' });
          n.marks = marks;
          nodes.push(n);
        }
      } else if (tag === 'code') {
        const text = $el.text();
        if (text) nodes.push({ type: 'text', text, marks: [{ type: 'code' }] });
      } else if (tag === 'a') {
        const inner = processInline($el);
        const rawHref = $el.attr('href') || '';
        // Sanitize dangerous URL schemes
        const href = /^(https?:|mailto:|\/|#)/i.test(rawHref) ? rawHref : '';
        for (const n of inner) {
          const marks = ((n.marks as any[]) || []);
          marks.push({ type: 'link', attrs: { href, target: '_blank' } });
          n.marks = marks;
          nodes.push(n);
        }
      } else if (tag === 'br') {
        nodes.push({ type: 'hardBreak' });
      } else if (tag === 'img') {
        const src = $el.attr('src') || '';
        nodes.push({ type: 'text', text: `[immagine: ${src}]` });
      } else if (tag === 'span') {
        nodes.push(...processInline($el));
      } else {
        const text = $el.text();
        if (text) nodes.push({ type: 'text', text });
      }
    });

    return nodes;
  }

  function processBlock(el: any) {
    el.children().each((_i: number, node: any) => {
      const $el = $(node);
      const tag = node.tagName?.toLowerCase();

      if (!tag) return;

      // Headings
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const level = Math.min(parseInt(tag[1]!), 3);
        const inlineContent = processInline($el);
        if (inlineContent.length > 0) {
          content.push({ type: 'heading', attrs: { level }, content: inlineContent });
        }
        return;
      }

      if (tag === 'p') {
        const inlineContent = processInline($el);
        if (inlineContent.length > 0) {
          content.push({ type: 'paragraph', content: inlineContent });
        } else {
          content.push({ type: 'paragraph' });
        }
        return;
      }

      if (tag === 'ul' || tag === 'ol') {
        const listType = tag === 'ul' ? 'bulletList' : 'orderedList';
        const items: Record<string, unknown>[] = [];
        $el.children('li').each((_j: number, li: any) => {
          const $li = $(li);
          const nestedList = $li.children('ul, ol');
          const textContent = processInline($li.clone().children('ul, ol').remove().end());
          const itemContent: Record<string, unknown>[] = [];
          if (textContent.length > 0) {
            itemContent.push({ type: 'paragraph', content: textContent });
          }
          if (nestedList.length) {
            nestedList.each((_k: number, nl: any) => {
              const nlTag = nl.tagName?.toLowerCase();
              const nlType = nlTag === 'ul' ? 'bulletList' : 'orderedList';
              const nlItems: Record<string, unknown>[] = [];
              $(nl).children('li').each((_l: number, nli: any) => {
                const nliContent = processInline($(nli));
                if (nliContent.length > 0) {
                  nlItems.push({ type: 'listItem', content: [{ type: 'paragraph', content: nliContent }] });
                }
              });
              if (nlItems.length) {
                itemContent.push({ type: nlType, content: nlItems });
              }
            });
          }
          if (itemContent.length > 0) {
            items.push({ type: 'listItem', content: itemContent });
          }
        });
        if (items.length > 0) {
          content.push({ type: listType, content: items });
        }
        return;
      }

      if (tag === 'blockquote') {
        const inner = processInline($el);
        if (inner.length > 0) {
          content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inner }] });
        }
        return;
      }

      // Code blocks — Confluence code macro
      if (tag === 'pre' || $el.hasClass('code-block') || $el.hasClass('codeContent')) {
        const code = $el.find('code').text() || $el.text();
        const language = $el.attr('data-language') || $el.find('code').attr('class')?.replace('language-', '') || null;
        content.push({
          type: 'codeBlock',
          attrs: { language },
          content: code ? [{ type: 'text', text: code }] : [],
        });
        return;
      }

      // Confluence info/warning/note macros → callout
      if ($el.hasClass('confluence-information-macro') || $el.hasClass('aui-message')) {
        let calloutType = 'info';
        if ($el.hasClass('confluence-information-macro-warning') || $el.hasClass('aui-message-warning')) {
          calloutType = 'warning';
        } else if ($el.hasClass('confluence-information-macro-tip') || $el.hasClass('aui-message-success')) {
          calloutType = 'success';
        } else if ($el.hasClass('confluence-information-macro-note') || $el.hasClass('aui-message-error')) {
          calloutType = 'error';
        }
        const macroBody = $el.find('.confluence-information-macro-body, .aui-message-content').first();
        const text = macroBody.length ? macroBody.text().trim() : $el.text().trim();
        if (text) {
          content.push({
            type: 'callout',
            attrs: { type: calloutType },
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          });
        }
        return;
      }

      if (tag === 'img') {
        const src = $el.attr('src') || '';
        content.push({ type: 'image', attrs: { src, alt: $el.attr('alt') || '' } });
        return;
      }

      if (tag === 'table') {
        const rows: Record<string, unknown>[] = [];
        $el.find('tr').each((_j: number, tr: any) => {
          const cells: Record<string, unknown>[] = [];
          $(tr).find('th, td').each((_k: number, cell: any) => {
            const cellTag = cell.tagName?.toLowerCase();
            const cellType = cellTag === 'th' ? 'tableHeader' : 'tableCell';
            const cellContent = processInline($(cell));
            cells.push({
              type: cellType,
              content: cellContent.length > 0
                ? [{ type: 'paragraph', content: cellContent }]
                : [{ type: 'paragraph' }],
            });
          });
          if (cells.length > 0) {
            rows.push({ type: 'tableRow', content: cells });
          }
        });
        if (rows.length > 0) {
          content.push({ type: 'table', content: rows });
        }
        return;
      }

      if (tag === 'hr') {
        content.push({ type: 'horizontalRule' });
        return;
      }

      if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
        processBlock($el);
        return;
      }

      // Fallback
      const text = $el.text().trim();
      if (text) {
        content.push({ type: 'paragraph', content: [{ type: 'text', text }] });
      }
    });
  }

  processBlock($('body').length ? $('body') : $.root());

  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { type: 'doc', content };
}
