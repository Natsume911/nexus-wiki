import AdmZip from 'adm-zip';
import path from 'path';
import { markdownToTiptap, extractTitle } from './importService.js';

export interface NotionParsedPage {
  title: string;
  content: Record<string, unknown>;
  parentPath: string | null;
  order: number;
}

export interface NotionAttachment {
  filename: string;
  buffer: Buffer;
  pagePath: string;
}

export interface NotionImportResult {
  pages: NotionParsedPage[];
  attachments: NotionAttachment[];
}

/**
 * Parse a Notion export ZIP.
 * Notion exports as:
 *   /Page Title abc123.md
 *   /Page Title abc123/
 *     Child Page def456.md
 *     image.png
 *     Child Page def456/
 *       ...
 */
export function parseNotionZip(buffer: Buffer): NotionImportResult {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const pages: NotionParsedPage[] = [];
  const attachments: NotionAttachment[] = [];

  // Separate MD files from other files
  const mdEntries = entries.filter(e => !e.isDirectory && e.entryName.endsWith('.md'));
  const otherEntries = entries.filter(e => !e.isDirectory && !e.entryName.endsWith('.md'));

  // Process markdown files
  for (const entry of mdEntries) {
    const md = entry.getData().toString('utf-8');
    const filePath = entry.entryName;

    // Extract title: Notion adds a hash suffix like "Page Title abc123.md"
    const basename = path.basename(filePath, '.md');
    // Remove Notion's hex suffix (last 20+ chars after last space if they look like a hash)
    const title = cleanNotionTitle(basename);

    // Determine parent from directory structure
    const dir = path.dirname(filePath);
    const parentPath = dir === '.' ? null : dir;

    const content = markdownToTiptap(md);

    pages.push({
      title: title || extractTitle(md),
      content,
      parentPath,
      order: pages.length,
    });
  }

  // Process images/attachments
  const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.mp4']);
  for (const entry of otherEntries) {
    const ext = path.extname(entry.entryName).toLowerCase();
    if (imageExts.has(ext) || entry.entryName.includes('Untitled')) {
      const pagePath = path.dirname(entry.entryName);
      attachments.push({
        filename: path.basename(entry.entryName),
        buffer: entry.getData(),
        pagePath,
      });
    }
  }

  return { pages, attachments };
}

/**
 * Clean Notion's title format: "My Page Title 4a3b2c1d..." → "My Page Title"
 */
function cleanNotionTitle(name: string): string {
  // Notion appends a 32-char hex hash after a space
  return name.replace(/\s+[0-9a-f]{20,}$/i, '').trim();
}
