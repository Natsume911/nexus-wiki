import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table as DocxTable, TableRow as DocxTableRow,
  TableCell as DocxTableCell, WidthType, ImageRun, ExternalHyperlink,
  Header, Footer, PageNumber, PageBreak,
  ShadingType,
  IRunOptions, IParagraphOptions,
} from 'docx';
import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(process.cwd(), 'templates');
const MAX_IMAGE_WIDTH = 550; // pixels, fits A4 with margins

// ============================================================
// Brand Constants (from template analysis)
// ============================================================

const FONT = {
  heading: 'Sora SemiBold',
  body: 'Sora Light',
  code: 'Courier New',
  math: 'Cambria Math',
};

// Half-points (divide by 2 for pt)
const SIZE = {
  h1: 32,        // 16pt
  h2: 28,        // 14pt
  h3: 26,        // 13pt
  body: 22,      // 11pt
  bodyLarge: 24, // 12pt
  small: 18,     // 9pt
  footer: 16,    // 8pt
  code: 20,      // 10pt
  coverTitle: 48, // 24pt
  coverDate: 36,  // 18pt
};

const COLOR = {
  black: '000000',
  white: 'FFFFFF',
  darkNavy: '2C3746',
  muted: '666464',
  tableBorder: 'AEAAAA',
  accent: '4472C4',
  red: 'FF0000',
  link: '0563C1',
  codeBg: 'F5F5F5',
  calloutBorder: '6366f1',
  green: '22c55e',
  yellow: 'eab308',
  purple: '8b5cf6',
  blue: '3b82f6',
  grey: '6b7280',
};

// Spacing in twips
const SPACING = {
  headingBefore: 120,
  headingAfter: 120,
  bodyAfter: 120,
  listAfter: 60,
  codeBlockBefore: 120,
  codeBlockAfter: 120,
};

// Default run style for body text
const bodyRun = (opts: Partial<IRunOptions> = {}): Partial<IRunOptions> => ({
  font: FONT.body,
  size: SIZE.body,
  ...opts,
});

const headingRun = (opts: Partial<IRunOptions> = {}): Partial<IRunOptions> => ({
  font: FONT.heading,
  ...opts,
});

// ============================================================
// Types
// ============================================================

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

interface ImageData {
  buffer: Buffer;
  width: number;
  height: number;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
}

// ============================================================
// Image loading helpers
// ============================================================

function collectImageSrcs(node: TipTapNode): string[] {
  const srcs: string[] = [];
  if (node.type === 'image' && node.attrs?.src) {
    srcs.push(node.attrs.src as string);
  }
  if (node.content) {
    for (const child of node.content) {
      srcs.push(...collectImageSrcs(child));
    }
  }
  return srcs;
}

function resolveImagePath(src: string): string | null {
  if (src.startsWith('/missing/')) return null;
  let relative = src;
  if (relative.startsWith('/wiki/uploads/')) relative = relative.slice('/wiki/uploads/'.length);
  else if (relative.startsWith('/uploads/')) relative = relative.slice('/uploads/'.length);
  else if (relative.startsWith('uploads/')) relative = relative.slice('uploads/'.length);
  else return null;

  const fullPath = path.resolve(UPLOAD_DIR, relative);
  // Prevent path traversal — resolved path must be within UPLOAD_DIR
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR))) return null;
  return fs.existsSync(fullPath) ? fullPath : null;
}

async function loadImages(doc: TipTapNode): Promise<Map<string, ImageData>> {
  const map = new Map<string, ImageData>();
  const srcs = [...new Set(collectImageSrcs(doc))];

  for (const src of srcs) {
    const filePath = resolveImagePath(src);
    if (!filePath) continue;
    try {
      const buffer = fs.readFileSync(filePath);
      const dims = sizeOf(buffer);
      if (!dims.width || !dims.height) continue;

      let width = dims.width;
      let height = dims.height;
      if (width > MAX_IMAGE_WIDTH) {
        const scale = MAX_IMAGE_WIDTH / width;
        width = MAX_IMAGE_WIDTH;
        height = Math.round(height * scale);
      }

      const ext = (dims.type || 'png').toLowerCase();
      const imgType = (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)
        ? (ext === 'jpeg' ? 'jpg' : ext)
        : 'png') as ImageData['type'];

      map.set(src, { buffer, width, height, type: imgType });
    } catch {
      // Skip unreadable images
    }
  }
  return map;
}

function loadLogo(): ImageData | null {
  const logoPath = path.join(TEMPLATES_DIR, 'nexus-logo.png');
  if (!fs.existsSync(logoPath)) return null;
  try {
    const buffer = fs.readFileSync(logoPath);
    const dims = sizeOf(buffer);
    return { buffer, width: dims.width || 397, height: dims.height || 54, type: 'png' };
  } catch {
    return null;
  }
}

function loadCoverImage(): ImageData | null {
  const coverPath = path.join(TEMPLATES_DIR, 'nexus-cover.jpeg');
  if (!fs.existsSync(coverPath)) return null;
  try {
    const buffer = fs.readFileSync(coverPath);
    return { buffer, width: 657, height: 270, type: 'jpg' };
  } catch {
    return null;
  }
}

// ============================================================
// Header & Footer (Branded)
// ============================================================

function createHeader(title: string, logo: ImageData | null): Header {
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.black },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.black },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.black },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLOR.black },
  };

  const logoCell = new DocxTableCell({
    children: [
      new Paragraph({
        children: logo
          ? [new ImageRun({
              data: logo.buffer,
              transformation: { width: 161, height: 22 },
              type: 'png',
            })]
          : [new TextRun({ text: 'NEXUS', ...headingRun({ size: SIZE.body }) })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      }),
    ],
    width: { size: 1336, type: WidthType.PCT },
    verticalAlign: 'center' as never,
    borders: cellBorder,
    margins: { left: 71, right: 71 },
  });

  const titleCell = new DocxTableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, ...headingRun({ size: SIZE.bodyLarge }) })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      }),
    ],
    width: { size: 2707, type: WidthType.PCT },
    verticalAlign: 'center' as never,
    borders: cellBorder,
    margins: { left: 71, right: 71 },
  });

  const pageNumCell = new DocxTableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: 'Pag. ', font: FONT.body }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT.body }),
          new TextRun({ text: ' di ', font: FONT.body }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT.body }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
      }),
    ],
    width: { size: 957, type: WidthType.PCT },
    verticalAlign: 'center' as never,
    borders: cellBorder,
    margins: { left: 71, right: 71 },
  });

  return new Header({
    children: [
      new DocxTable({
        rows: [new DocxTableRow({
          children: [logoCell, titleCell, pageNumCell],
          height: { value: 699, rule: 'atLeast' as never },
        })],
        width: { size: 5008, type: WidthType.PCT },
        columnWidths: [2576, 5221, 1846],
      }),
    ],
  });
}

function createFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: 'Documento confidenziale',
            font: FONT.body,
            size: SIZE.footer,
          }),
        ],
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, space: 1, color: COLOR.black },
        },
        spacing: { before: 80 },
      }),
    ],
  });
}

// ============================================================
// Cover page
// ============================================================

function createCoverPage(title: string, spaceName: string, logo: ImageData | null, coverImg: ImageData | null): Paragraph[] {
  const now = new Date();
  const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;

  const items: Paragraph[] = [];

  // Spacers
  items.push(new Paragraph({ spacing: { after: 400 } }));
  items.push(new Paragraph({ spacing: { after: 400 } }));

  // Logo
  if (logo) {
    items.push(new Paragraph({
      children: [new ImageRun({
        data: logo.buffer,
        transformation: { width: 370, height: 51 },
        type: 'png',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }));
  }

  // Cover image
  if (coverImg) {
    items.push(new Paragraph({
      children: [new ImageRun({
        data: coverImg.buffer,
        transformation: { width: coverImg.width, height: coverImg.height },
        type: coverImg.type,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  // Spacer
  items.push(new Paragraph({ spacing: { after: 400 } }));

  // Space name
  if (spaceName) {
    items.push(new Paragraph({
      children: [new TextRun({
        text: spaceName,
        ...headingRun({ size: SIZE.coverTitle, color: COLOR.black }),
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }));
  }

  // Separator
  items.push(new Paragraph({
    children: [new TextRun({
      text: ' — ',
      ...headingRun({ size: SIZE.coverTitle, color: COLOR.muted }),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));

  // Document title
  items.push(new Paragraph({
    children: [new TextRun({
      text: title,
      ...headingRun({ size: SIZE.coverTitle, color: COLOR.black }),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  // Date
  items.push(new Paragraph({
    children: [new TextRun({
      text: dateStr,
      ...bodyRun({ size: SIZE.coverDate, color: COLOR.muted }),
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
  }));

  // Page break after cover
  items.push(new Paragraph({
    children: [new PageBreak()],
  }));

  return items;
}

// ============================================================
// Markdown export (unchanged)
// ============================================================

export function tiptapToMarkdown(doc: TipTapNode): string {
  if (!doc.content) return '';
  return doc.content.map((node) => nodeToMarkdown(node, 0)).join('\n\n');
}

function nodeToMarkdown(node: TipTapNode, depth: number): string {
  switch (node.type) {
    case 'paragraph':
      return inlineToMarkdown(node.content);
    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      return '#'.repeat(level) + ' ' + inlineToMarkdown(node.content);
    }
    case 'bulletList':
      return (node.content || []).map((li) => listItemToMd(li, '- ', depth)).join('\n');
    case 'orderedList':
      return (node.content || []).map((li, i) => listItemToMd(li, `${i + 1}. `, depth)).join('\n');
    case 'taskList':
      return (node.content || []).map((li) => {
        const checked = li.attrs?.checked ? '[x]' : '[ ]';
        return `${'  '.repeat(depth)}- ${checked} ${inlineFromListItem(li)}`;
      }).join('\n');
    case 'listItem':
      return inlineFromListItem(node);
    case 'blockquote':
      return (node.content || []).map((n) => '> ' + nodeToMarkdown(n, depth)).join('\n> \n');
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) || '';
      return '```' + lang + '\n' + plainText(node.content) + '\n```';
    }
    case 'horizontalRule':
      return '---';
    case 'image':
      return `![${(node.attrs?.alt as string) || ''}](${(node.attrs?.src as string) || ''})`;
    case 'table':
      return tableToMarkdown(node);
    case 'callout': {
      const cType = ((node.attrs?.type as string) || 'info').toUpperCase();
      return `> **${cType}**: ${(node.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n> ')}`;
    }
    case 'detailsBlock': {
      const summary = (node.content || []).find((n) => n.type === 'detailsSummary');
      const content = (node.content || []).find((n) => n.type === 'detailsContent');
      const summaryText = summary ? inlineToMarkdown(summary.content) : '';
      const bodyText = content ? (content.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n') : '';
      return `<details>\n<summary>${summaryText}</summary>\n\n${bodyText}\n\n</details>`;
    }
    case 'detailsSummary':
      return inlineToMarkdown(node.content);
    case 'detailsContent':
      return (node.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n');
    case 'columns':
      return (node.content || [])
        .map((col, i) => {
          const inner = (col.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n');
          return `**Colonna ${i + 1}**\n\n${inner}`;
        })
        .join('\n\n---\n\n');
    case 'column':
      return (node.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n');
    case 'tabGroup':
      return (node.content || [])
        .map((tab) => {
          const t = (tab.attrs?.title as string) || 'Tab';
          const inner = (tab.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n');
          return `### ${t}\n\n${inner}`;
        })
        .join('\n\n');
    case 'tabItem': {
      const t = (node.attrs?.title as string) || 'Tab';
      const inner = (node.content || []).map((n) => nodeToMarkdown(n, depth)).join('\n\n');
      return `### ${t}\n\n${inner}`;
    }
    case 'statusBadge':
      return `\`[${(node.attrs?.text as string) || 'STATUS'}]\``;
    case 'mermaidBlock':
      return '```mermaid\n' + ((node.attrs?.code as string) || '') + '\n```';
    case 'mathBlock':
      return '$$\n' + ((node.attrs?.tex as string) || '') + '\n$$';
    case 'mathInline':
      return `$${(node.attrs?.tex as string) || ''}$`;
    case 'videoEmbed': {
      const url = (node.attrs?.originalUrl as string) || (node.attrs?.src as string) || '';
      return url ? `[Video](${url})` : '';
    }
    case 'pageLink':
      return `[${(node.attrs?.title as string) || 'Pagina'}](${(node.attrs?.href as string) || ''})`;
    case 'mention':
      return `@${(node.attrs?.label as string) || ''}`;
    case 'tableOfContents':
      return '*[Indice dei contenuti]*';
    default:
      if (node.content && node.content.length > 0) {
        return node.content.map((n) => nodeToMarkdown(n, depth)).join('\n\n');
      }
      return inlineToMarkdown(node.content);
  }
}

function inlineToMarkdown(content?: TipTapNode[]): string {
  if (!content) return '';
  return content.map((node) => {
    if (node.type === 'text') {
      let text = node.text || '';
      for (const mark of (node.marks || [])) {
        if (mark.type === 'bold') text = `**${text}**`;
        else if (mark.type === 'italic') text = `*${text}*`;
        else if (mark.type === 'strike') text = `~~${text}~~`;
        else if (mark.type === 'code') text = '`' + text + '`';
        else if (mark.type === 'link') text = `[${text}](${(mark.attrs?.href as string) || ''})`;
      }
      return text;
    }
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'statusBadge') return `\`[${(node.attrs?.text as string) || 'STATUS'}]\``;
    if (node.type === 'mathInline') return `$${(node.attrs?.tex as string) || ''}$`;
    if (node.type === 'pageLink') return `[${(node.attrs?.title as string) || 'Pagina'}](${(node.attrs?.href as string) || ''})`;
    if (node.type === 'mention') return `@${(node.attrs?.label as string) || ''}`;
    return nodeToMarkdown(node, 0);
  }).join('');
}

function inlineFromListItem(li: TipTapNode): string {
  if (!li.content) return '';
  return li.content.map((child) => {
    if (child.type === 'paragraph') return inlineToMarkdown(child.content);
    return nodeToMarkdown(child, 0);
  }).join(' ');
}

function listItemToMd(li: TipTapNode, prefix: string, depth: number): string {
  return '  '.repeat(depth) + prefix + inlineFromListItem(li);
}

function plainText(content?: TipTapNode[]): string {
  if (!content) return '';
  return content.map((n) => n.text || '').join('');
}

function deepPlainText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(deepPlainText).join('');
}

function tableToMarkdown(table: TipTapNode): string {
  const rows = (table.content || []).filter((r) => r.type === 'tableRow');
  if (!rows.length) return '';
  const result: string[] = [];
  rows.forEach((row, ri) => {
    const cells = (row.content || []).map((cell) => {
      return (cell.content || []).map((n) => nodeToMarkdown(n, 0)).join(' ');
    });
    result.push('| ' + cells.join(' | ') + ' |');
    if (ri === 0) result.push('| ' + cells.map(() => '---').join(' | ') + ' |');
  });
  return result.join('\n');
}

// ============================================================
// DOCX export — Branded
// ============================================================

export async function tiptapToDocx(doc: TipTapNode, title: string, spaceName?: string): Promise<Buffer> {
  const images = await loadImages(doc);
  const logo = loadLogo();
  const coverImg = loadCoverImage();
  const children = docNodeToDocx(doc, images);

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT.body, size: SIZE.body },
          paragraph: { spacing: { line: 259, after: 120 } },
        },
        heading1: {
          run: { font: FONT.heading, size: SIZE.h1, color: COLOR.black },
          paragraph: {
            spacing: { before: SPACING.headingBefore, after: SPACING.headingAfter },
          },
        },
        heading2: {
          run: { font: FONT.heading, size: SIZE.h2, color: COLOR.black },
          paragraph: {
            spacing: { before: SPACING.headingBefore, after: SPACING.headingAfter },
          },
        },
        heading3: {
          run: { font: FONT.heading, size: SIZE.h3, color: COLOR.black },
          paragraph: {
            spacing: { before: SPACING.headingBefore, after: SPACING.headingAfter },
          },
        },
      },
    },
    sections: [
      // Cover page (no header/footer)
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 1417, right: 1134, bottom: 1134, left: 1134,
              header: 708, footer: 708,
            },
          },
        },
        children: createCoverPage(title, spaceName || '', logo, coverImg),
      },
      // Content section (with header + footer)
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 1417, right: 1134, bottom: 1134, left: 1134,
              header: 708, footer: 708,
            },
          },
        },
        headers: { default: createHeader(title, logo) },
        footers: { default: createFooter() },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

function docNodeToDocx(node: TipTapNode, images: Map<string, ImageData>): (Paragraph | DocxTable)[] {
  if (!node.content) return [];
  return node.content.flatMap((child) => blockToDocx(child, images));
}

function blockToDocx(node: TipTapNode, images: Map<string, ImageData>): (Paragraph | DocxTable)[] {
  switch (node.type) {
    case 'paragraph':
      return [new Paragraph({
        children: inlineToDocx(node.content, images),
        spacing: { after: SPACING.bodyAfter },
      })];

    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      // DON'T use inlineToDocx — it overrides font/size with body style.
      // Let heading TextRuns inherit from the paragraph heading style.
      const headingRuns = (node.content || []).map((child) => {
        if (child.type === 'text') {
          const marks = child.marks || [];
          return new TextRun({
            text: child.text || '',
            // Only set marks that are explicitly true — no font/size override
            bold: marks.some((m) => m.type === 'bold') || undefined,
            italics: marks.some((m) => m.type === 'italic') || undefined,
            strike: marks.some((m) => m.type === 'strike') || undefined,
            underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
          });
        }
        if (child.type === 'hardBreak') return new TextRun({ text: '', break: 1 });
        return new TextRun({ text: deepPlainText(child) });
      });
      return [new Paragraph({
        children: headingRuns,
        heading: headingMap[level] || HeadingLevel.HEADING_3,
        spacing: { before: SPACING.headingBefore, after: SPACING.headingAfter },
      })];
    }

    case 'bulletList':
    case 'orderedList':
      return (node.content || []).flatMap((li, i) =>
        listItemToDocxBranded(li, node.type === 'orderedList', i, images)
      );

    case 'taskList':
      return (node.content || []).flatMap((li) => {
        const checked = li.attrs?.checked ? '\u2611' : '\u2610';
        return [new Paragraph({
          children: [
            new TextRun({ text: `${checked} `, ...bodyRun({ size: SIZE.body }) }),
            ...inlineToDocx(liContent(li), images),
          ],
          indent: { left: 400 },
          spacing: { after: SPACING.listAfter },
        })];
      });

    case 'blockquote':
      return (node.content || []).flatMap((n) => {
        return [new Paragraph({
          children: [
            new TextRun({ text: '\u2502 ', ...bodyRun({ color: COLOR.muted }) }),
            ...inlineToDocx(n.content, images),
          ],
          indent: { left: 400 },
          spacing: { after: SPACING.listAfter },
          border: { left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.tableBorder } },
        })];
      });

    case 'codeBlock': {
      const code = plainText(node.content);
      const lang = (node.attrs?.language as string) || '';
      const runs: TextRun[] = [];
      if (lang) {
        runs.push(new TextRun({
          text: lang.toUpperCase(),
          font: FONT.heading,
          size: SIZE.small,
          color: COLOR.white,
        }));
        runs.push(new TextRun({ text: '', break: 1 }));
      }
      runs.push(new TextRun({ text: code, font: FONT.code, size: SIZE.code }));
      return [new Paragraph({
        children: runs,
        spacing: { before: SPACING.codeBlockBefore, after: SPACING.codeBlockAfter },
        shading: { type: ShadingType.SOLID, color: COLOR.codeBg, fill: COLOR.codeBg },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
          left: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
          right: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
        },
      })];
    }

    case 'horizontalRule':
      return [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder } },
        spacing: { before: 200, after: 200 },
      })];

    case 'table':
      return [tableToDocx(node, images)];

    case 'callout': {
      const label = ((node.attrs?.type as string) || 'INFO').toUpperCase();
      const bodyContent = (node.content || []).map((n) => inlineFromListItem(n)).join(' ');
      return [new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, ...headingRun({ size: SIZE.body }) }),
          new TextRun({ text: bodyContent, ...bodyRun() }),
        ],
        indent: { left: 400 },
        spacing: { before: 120, after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: COLOR.calloutBorder } },
      })];
    }

    // --- Custom nodes ---

    case 'detailsBlock': {
      const summary = (node.content || []).find((n) => n.type === 'detailsSummary');
      const detailsBody = (node.content || []).find((n) => n.type === 'detailsContent');
      const summaryText = summary ? deepPlainText(summary) : '';
      const bodyBlocks = detailsBody
        ? (detailsBody.content || []).flatMap((n) => blockToDocx(n, images))
        : [];
      return [
        new Paragraph({
          children: [new TextRun({ text: `\u25BC ${summaryText}`, ...headingRun({ size: SIZE.body }) })],
          spacing: { before: 160, after: 80 },
          border: { left: { style: BorderStyle.SINGLE, size: 4, color: COLOR.purple } },
          indent: { left: 200 },
        }),
        ...bodyBlocks,
      ];
    }
    case 'detailsSummary':
      return [new Paragraph({ children: inlineToDocx(node.content, images), spacing: { after: 60 } })];
    case 'detailsContent':
      return (node.content || []).flatMap((n) => blockToDocx(n, images));

    case 'columns': {
      const cols = node.content || [];
      if (cols.length > 0 && cols.every((c) => c.type === 'column')) {
        const tableRow = new DocxTableRow({
          children: cols.map((col) => {
            const cellContent = (col.content || []).flatMap((n) => blockToDocx(n, images));
            return new DocxTableCell({
              children: cellContent.length > 0 ? cellContent as Paragraph[] : [new Paragraph({})],
              width: { size: Math.floor(9000 / cols.length), type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: COLOR.white },
                bottom: { style: BorderStyle.NONE, size: 0, color: COLOR.white },
                left: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
                right: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
              },
            });
          }),
        });
        return [
          new DocxTable({
            rows: [tableRow],
            width: { size: 9000, type: WidthType.DXA },
          }),
          new Paragraph({ spacing: { after: 120 } }),
        ];
      }
      return [];
    }
    case 'column':
      return (node.content || []).flatMap((n) => blockToDocx(n, images));

    case 'tabGroup': {
      const result: (Paragraph | DocxTable)[] = [];
      for (const tab of (node.content || [])) {
        const tabTitle = (tab.attrs?.title as string) || 'Tab';
        result.push(new Paragraph({
          children: [new TextRun({ text: `\u25B8 ${tabTitle}`, ...headingRun({ size: SIZE.body, color: COLOR.accent }) })],
          spacing: { before: 200, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.accent } },
        }));
        result.push(...(tab.content || []).flatMap((n) => blockToDocx(n, images)));
      }
      return result;
    }
    case 'tabItem': {
      const tabTitle = (node.attrs?.title as string) || 'Tab';
      return [
        new Paragraph({
          children: [new TextRun({ text: `\u25B8 ${tabTitle}`, ...headingRun({ size: SIZE.body, color: COLOR.accent }) })],
          spacing: { before: 200, after: 80 },
        }),
        ...(node.content || []).flatMap((n) => blockToDocx(n, images)),
      ];
    }

    case 'statusBadge': {
      const text = (node.attrs?.text as string) || 'STATUS';
      const colorMap: Record<string, string> = {
        grey: COLOR.grey, blue: COLOR.blue, green: COLOR.green,
        yellow: COLOR.yellow, red: COLOR.red, purple: COLOR.purple,
      };
      const color = colorMap[(node.attrs?.color as string) || 'grey'] || COLOR.grey;
      return [new Paragraph({
        children: [new TextRun({ text: `[${text}]`, ...headingRun({ size: SIZE.body, color }) })],
        spacing: { after: 60 },
      })];
    }

    case 'mermaidBlock': {
      const code = (node.attrs?.code as string) || '';
      return [
        new Paragraph({
          children: [new TextRun({ text: 'Diagramma Mermaid:', ...bodyRun({ italics: true, color: COLOR.grey }) })],
          spacing: { before: 120, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: code, font: FONT.code, size: SIZE.code })],
          spacing: { after: 120 },
          shading: { type: ShadingType.SOLID, color: COLOR.codeBg, fill: COLOR.codeBg },
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLOR.tableBorder },
          },
        }),
      ];
    }

    case 'mathBlock':
      return [new Paragraph({
        children: [new TextRun({ text: (node.attrs?.tex as string) || '', font: FONT.math, italics: true, size: SIZE.body })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      })];

    case 'mathInline':
      return [new Paragraph({
        children: [new TextRun({ text: (node.attrs?.tex as string) || '', font: FONT.math, italics: true, size: SIZE.body })],
      })];

    case 'videoEmbed': {
      const url = (node.attrs?.originalUrl as string) || (node.attrs?.src as string) || '';
      if (!url) return [];
      return [new Paragraph({
        children: [
          new TextRun({ text: '\uD83C\uDFA5 Video: ', ...headingRun({ size: SIZE.body }) }),
          new ExternalHyperlink({
            children: [new TextRun({ text: url, ...bodyRun({ color: COLOR.link, underline: {} }) })],
            link: url,
          }),
        ],
        spacing: { before: 80, after: 80 },
      })];
    }

    case 'pageLink':
      return [new Paragraph({
        children: [new TextRun({
          text: `\uD83D\uDCC4 ${(node.attrs?.title as string) || 'Pagina collegata'}`,
          ...bodyRun({ color: COLOR.link }),
        })],
        spacing: { after: 60 },
      })];

    case 'mention':
      return [new Paragraph({
        children: [new TextRun({
          text: `@${(node.attrs?.label as string) || ''}`,
          ...headingRun({ size: SIZE.body, color: COLOR.accent }),
        })],
      })];

    case 'tableOfContents':
      return [new Paragraph({
        children: [new TextRun({ text: '[Indice dei contenuti]', ...bodyRun({ italics: true, color: COLOR.muted }) })],
        spacing: { before: 120, after: 120 },
      })];

    case 'image': {
      const src = (node.attrs?.src as string) || '';
      const imgData = images.get(src);
      if (imgData) {
        return [new Paragraph({
          children: [new ImageRun({
            data: imgData.buffer,
            transformation: { width: imgData.width, height: imgData.height },
            type: imgData.type,
          })],
          spacing: { before: 120, after: 120 },
        })];
      }
      const alt = (node.attrs?.alt as string) || '';
      const label = alt || src.split('/').pop() || 'Immagine';
      return [new Paragraph({
        children: [new TextRun({
          text: `[Immagine: ${label}]`,
          ...bodyRun({ italics: true, color: COLOR.muted }),
        })],
        spacing: { before: 80, after: 80 },
      })];
    }

    default: {
      if (node.content && node.content.length > 0) {
        return node.content.flatMap((n) => blockToDocx(n, images));
      }
      return [new Paragraph({ children: inlineToDocx(node.content, images) })];
    }
  }
}

// ============================================================
// Inline rendering
// ============================================================

type InlineRun = TextRun | ExternalHyperlink | ImageRun;

function inlineToDocx(content?: TipTapNode[], images?: Map<string, ImageData>): InlineRun[] {
  if (!content) return [];
  const runs: InlineRun[] = [];

  for (const node of content) {
    if (node.type === 'text') {
      const marks = node.marks || [];
      const linkMark = marks.find((m) => m.type === 'link');

      const runOpts: Partial<IRunOptions> = {
        text: node.text || '',
        font: marks.some((m) => m.type === 'code') ? FONT.code : FONT.body,
        size: marks.some((m) => m.type === 'code') ? SIZE.code : SIZE.body,
        bold: marks.some((m) => m.type === 'bold'),
        italics: marks.some((m) => m.type === 'italic'),
        strike: marks.some((m) => m.type === 'strike'),
        underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
        highlight: marks.some((m) => m.type === 'highlight') ? 'yellow' : undefined,
        color: marks.some((m) => m.type === 'code') ? COLOR.darkNavy : undefined,
      };

      // Bold text uses heading font
      if (runOpts.bold && !marks.some((m) => m.type === 'code')) {
        runOpts.font = FONT.heading;
      }

      if (linkMark) {
        runs.push(new ExternalHyperlink({
          children: [new TextRun({ ...runOpts, color: COLOR.link, underline: {} })],
          link: (linkMark.attrs?.href as string) || '',
        }));
      } else {
        runs.push(new TextRun(runOpts));
      }
    } else if (node.type === 'hardBreak') {
      runs.push(new TextRun({ text: '', break: 1 }));
    } else if (node.type === 'image' && images) {
      const src = (node.attrs?.src as string) || '';
      const imgData = images.get(src);
      if (imgData) {
        runs.push(new ImageRun({
          data: imgData.buffer,
          transformation: { width: imgData.width, height: imgData.height },
          type: imgData.type,
        }));
      }
    } else if (node.type === 'statusBadge') {
      const text = (node.attrs?.text as string) || 'STATUS';
      const colorMap: Record<string, string> = {
        grey: COLOR.grey, blue: COLOR.blue, green: COLOR.green,
        yellow: COLOR.yellow, red: COLOR.red, purple: COLOR.purple,
      };
      const color = colorMap[(node.attrs?.color as string) || 'grey'] || COLOR.grey;
      runs.push(new TextRun({ text: `[${text}]`, ...headingRun({ size: SIZE.body, color }) }));
    } else if (node.type === 'mathInline') {
      runs.push(new TextRun({ text: (node.attrs?.tex as string) || '', font: FONT.math, italics: true, size: SIZE.body }));
    } else if (node.type === 'pageLink') {
      runs.push(new TextRun({
        text: `\uD83D\uDCC4 ${(node.attrs?.title as string) || 'Pagina'}`,
        ...bodyRun({ color: COLOR.link }),
      }));
    } else if (node.type === 'mention') {
      runs.push(new TextRun({
        text: `@${(node.attrs?.label as string) || ''}`,
        ...headingRun({ size: SIZE.body, color: COLOR.accent }),
      }));
    } else {
      runs.push(new TextRun({ text: node.text || deepPlainText(node), ...bodyRun() }));
    }
  }

  return runs;
}

// ============================================================
// List items
// ============================================================

function liContent(li: TipTapNode): TipTapNode[] | undefined {
  if (!li.content) return undefined;
  const para = li.content.find((c) => c.type === 'paragraph');
  return para?.content;
}

function listItemToDocxBranded(
  li: TipTapNode, ordered: boolean, index: number, images: Map<string, ImageData>
): Paragraph[] {
  const bullet = ordered ? `${index + 1}. ` : '\u2022 ';
  const result: Paragraph[] = [];

  if (li.content) {
    for (let i = 0; i < li.content.length; i++) {
      const child = li.content[i];
      if (child.type === 'paragraph') {
        const prefix = i === 0 ? bullet : '  ';
        result.push(new Paragraph({
          children: [
            new TextRun({ text: prefix, ...bodyRun() }),
            ...inlineToDocx(child.content, images),
          ],
          indent: { left: 400 },
          spacing: { after: SPACING.listAfter },
        }));
      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
        // Nested list
        result.push(...(child.content || []).flatMap((subLi, si) =>
          listItemToDocxBranded(subLi, child.type === 'orderedList', si, images).map((p) => {
            // Add extra indentation for nested lists
            return new Paragraph({
              ...p as unknown as IParagraphOptions,
              children: inlineToDocx(liContent(subLi), images).length > 0
                ? [
                    new TextRun({ text: child.type === 'orderedList' ? `${si + 1}. ` : '  \u25E6 ', ...bodyRun() }),
                    ...inlineToDocx(liContent(subLi), images),
                  ]
                : [new TextRun({ text: deepPlainText(subLi), ...bodyRun() })],
              indent: { left: 800 },
              spacing: { after: SPACING.listAfter },
            });
          })
        ));
      } else {
        result.push(...blockToDocx(child, images));
      }
    }
  }

  if (result.length === 0) {
    result.push(new Paragraph({
      children: [new TextRun({ text: `${bullet}${inlineFromListItem(li)}`, ...bodyRun() })],
      indent: { left: 400 },
      spacing: { after: SPACING.listAfter },
    }));
  }

  return result;
}

// ============================================================
// Tables — Nexus style (black header, gray borders)
// ============================================================

function tableToDocx(table: TipTapNode, images: Map<string, ImageData>): DocxTable {
  const rows = (table.content || []).filter((r) => r.type === 'tableRow');
  const borderOpts = {
    style: BorderStyle.SINGLE as const,
    size: 6,
    color: COLOR.tableBorder,
  };

  return new DocxTable({
    rows: rows.map((row, ri) => {
      const numCols = (row.content || []).length;
      const cells = (row.content || []).map((cell) => {
        const isHeader = cell.type === 'tableHeader' || ri === 0;
        const cellBlocks = (cell.content || []).flatMap((n) => blockToDocx(n, images));
        const cellChildren = cellBlocks.length > 0 ? cellBlocks : [new Paragraph({})];

        // Override text style for header cells
        const styledChildren = isHeader
          ? cellChildren.map((p) => {
              if (p instanceof Paragraph) {
                return new Paragraph({
                  children: [new TextRun({
                    text: deepPlainText(cell),
                    font: FONT.heading,
                    size: SIZE.small,
                    color: COLOR.white,
                  })],
                });
              }
              return p;
            })
          : cellChildren;

        return new DocxTableCell({
          children: styledChildren as Paragraph[],
          width: { size: Math.floor(5000 / numCols), type: WidthType.PCT },
          shading: isHeader
            ? { type: ShadingType.SOLID, color: COLOR.black, fill: COLOR.black }
            : undefined,
          borders: {
            top: borderOpts,
            bottom: borderOpts,
            left: borderOpts,
            right: borderOpts,
          },
        });
      });
      return new DocxTableRow({ children: cells });
    }),
    width: { size: 5000, type: WidthType.PCT },
  });
}
