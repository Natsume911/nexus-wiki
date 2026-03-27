import OpenAI from 'openai';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

// Lazy init — only when OPENAI_API_KEY is set
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ── Types ──────────────────────────────────────────────────────────
interface Chunk {
  heading: string | null;
  content: string;
  hash: string;
}

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
}

// ── Constants ──────────────────────────────────────────────────────
const TARGET_CHUNK_CHARS = 1600;  // ~400 tokens
const MAX_CHUNK_CHARS = 3200;     // hard ceiling
const OVERLAP_CHARS = 200;        // ~50 token overlap between adjacent chunks

// ── 1. chunkTipTapContent ──────────────────────────────────────────
// Walks TipTap JSON → smart chunking with overlap.
// Strategy:
//   - Heading-delimited sections (primary split)
//   - Sliding window with overlap for long sections or headingless content
//   - Code blocks & tables = dedicated chunks with surrounding context
//   - Context prefix on every chunk: "[Space > Page > Heading]"

export function chunkTipTapContent(
  pageTitle: string,
  spaceName: string,
  content: unknown,
): Chunk[] {
  const doc = content as TipTapNode;
  if (!doc || !doc.content) return [];

  // Phase 1: collect raw sections (heading-delimited)
  const sections: { heading: string | null; blocks: { type: string; text: string; lang?: string }[] }[] = [];
  let currentSection: typeof sections[0] = { heading: null, blocks: [] };

  for (const node of doc.content) {
    if (node.type === 'heading') {
      if (currentSection.blocks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: extractText(node), blocks: [] };
      continue;
    }

    const text = extractText(node).trim();
    if (!text) continue;

    if (node.type === 'codeBlock') {
      currentSection.blocks.push({
        type: 'code',
        text,
        lang: (node.attrs?.language as string) || undefined,
      });
    } else if (node.type === 'table') {
      currentSection.blocks.push({ type: 'table', text });
    } else {
      currentSection.blocks.push({ type: 'text', text });
    }
  }
  if (currentSection.blocks.length > 0) {
    sections.push(currentSection);
  }

  // Phase 2: convert sections → chunks with overlap
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const prefix = buildPrefix(spaceName, pageTitle, section.heading);

    // Separate code/table blocks (dedicated chunks) from prose
    const proseTexts: string[] = [];
    for (const block of section.blocks) {
      if (block.type === 'code' || block.type === 'table') {
        // Flush accumulated prose first
        if (proseTexts.length > 0) {
          const proseStr = proseTexts.join('\n');
          pushChunksWithOverlap(chunks, prefix, section.heading, proseStr);
          proseTexts.length = 0;
        }
        // Code/table as dedicated chunk with context
        const label = block.type === 'code'
          ? `[codice${block.lang ? ` ${block.lang}` : ''}]`
          : '[tabella]';
        const fullText = `${prefix}\n${label}\n${block.text}`;
        chunks.push({
          heading: section.heading,
          content: fullText.slice(0, MAX_CHUNK_CHARS),
          hash: hashStr(fullText),
        });
      } else {
        proseTexts.push(block.text);
      }
    }

    // Flush remaining prose
    if (proseTexts.length > 0) {
      pushChunksWithOverlap(chunks, prefix, section.heading, proseTexts.join('\n'));
    }
  }

  // Fallback: empty page
  if (chunks.length === 0) {
    const prefix = buildPrefix(spaceName, pageTitle, null);
    chunks.push({ heading: null, content: prefix, hash: hashStr(prefix) });
  }

  return chunks;
}

// ── Sliding window with overlap ────────────────────────────────────

function pushChunksWithOverlap(
  chunks: Chunk[],
  prefix: string,
  heading: string | null,
  text: string,
): void {
  // Short enough? Single chunk.
  if (prefix.length + 1 + text.length <= TARGET_CHUNK_CHARS) {
    const full = `${prefix}\n${text}`;
    chunks.push({ heading, content: full, hash: hashStr(full) });
    return;
  }

  // Sliding window split at sentence/line boundaries with overlap
  const sentences = splitAtBoundaries(text);
  let windowStart = 0;

  while (windowStart < sentences.length) {
    let windowText = '';
    let windowEnd = windowStart;

    // Fill window up to target size
    while (windowEnd < sentences.length) {
      const candidate = windowText
        ? windowText + '\n' + sentences[windowEnd]
        : sentences[windowEnd];
      if (candidate.length > TARGET_CHUNK_CHARS && windowText) break;
      windowText = candidate;
      windowEnd++;
    }

    const full = `${prefix}\n${windowText}`;
    chunks.push({ heading, content: full, hash: hashStr(full) });

    // Move start forward, but leave overlap
    if (windowEnd >= sentences.length) break;

    // Calculate how many sentences to keep for overlap
    let overlapChars = 0;
    let overlapStart = windowEnd;
    while (overlapStart > windowStart && overlapChars < OVERLAP_CHARS) {
      overlapStart--;
      overlapChars += sentences[overlapStart].length + 1;
    }
    windowStart = Math.max(overlapStart, windowStart + 1);
  }
}

function splitAtBoundaries(text: string): string[] {
  // Split on newlines first, then on sentence endings for very long lines
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.length <= TARGET_CHUNK_CHARS / 2) {
      if (line.trim()) result.push(line);
    } else {
      // Split long lines at sentence boundaries
      const sentenceRegex = /[.!?;]\s+/g;
      let lastIdx = 0;
      let match: RegExpExecArray | null;
      while ((match = sentenceRegex.exec(line)) !== null) {
        const piece = line.slice(lastIdx, match.index + match[0].length).trim();
        if (piece) result.push(piece);
        lastIdx = match.index + match[0].length;
      }
      const remainder = line.slice(lastIdx).trim();
      if (remainder) result.push(remainder);
    }
  }

  return result;
}

// ── 2. embedChunks ─────────────────────────────────────────────────

export async function embedChunks(texts: string[]): Promise<number[][] | null> {
  const ai = getOpenAI();
  if (!ai || texts.length === 0) return null;

  try {
    // Batch in groups of 100 (OpenAI limit is 2048 but 100 is safe)
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const response = await ai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }
    return allEmbeddings;
  } catch (err) {
    console.error('[chunkingService] embedding error:', err);
    return null;
  }
}

// ── 3. syncPageChunks ──────────────────────────────────────────────

export async function syncPageChunks(pageId: string): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { space: { select: { name: true } } },
  });
  if (!page || page.deletedAt) {
    await prisma.pageChunk.deleteMany({ where: { pageId } });
    return;
  }

  const newChunks = chunkTipTapContent(page.title, page.space.name, page.content);

  // Get existing chunks for diff
  const existing = await prisma.pageChunk.findMany({
    where: { pageId },
    select: { id: true, chunkIndex: true, contentHash: true },
    orderBy: { chunkIndex: 'asc' },
  });

  // Check which chunks lack embeddings
  const chunksWithoutEmbedding = await prisma.$queryRawUnsafe<{ chunk_index: number }[]>(
    `SELECT chunk_index FROM page_chunks WHERE page_id = $1 AND embedding IS NULL`, pageId,
  );
  const missingEmbeddingSet = new Set(chunksWithoutEmbedding.map(c => c.chunk_index));
  const existingByIndex = new Map(existing.map((c) => [c.chunkIndex, c]));

  // Determine which chunks need embedding (changed OR missing embedding)
  const toEmbed: { index: number; content: string }[] = [];
  for (let i = 0; i < newChunks.length; i++) {
    const ex = existingByIndex.get(i);
    if (!ex || ex.contentHash !== newChunks[i].hash || missingEmbeddingSet.has(i)) {
      toEmbed.push({ index: i, content: newChunks[i].content });
    }
  }

  // Embed new/changed chunks
  let embeddings: number[][] | null = null;
  if (toEmbed.length > 0) {
    embeddings = await embedChunks(toEmbed.map((t) => t.content));
  }

  // Upsert chunks in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete excess old chunks
    if (existing.length > newChunks.length) {
      await tx.pageChunk.deleteMany({
        where: { pageId, chunkIndex: { gte: newChunks.length } },
      });
    }

    for (let i = 0; i < newChunks.length; i++) {
      const chunk = newChunks[i];
      const embIdx = toEmbed.findIndex((t) => t.index === i);
      const needsUpdate = embIdx !== -1;

      if (needsUpdate) {
        const embedding = embeddings?.[embIdx] ?? null;
        const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

        await tx.$executeRawUnsafe(
          `INSERT INTO page_chunks (id, page_id, chunk_index, heading, content, content_hash, embedding, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW(), NOW())
           ON CONFLICT (page_id, chunk_index) DO UPDATE SET
             heading = EXCLUDED.heading,
             content = EXCLUDED.content,
             content_hash = EXCLUDED.content_hash,
             embedding = EXCLUDED.embedding,
             updated_at = NOW()`,
          existingByIndex.get(i)?.id ?? generateCuid(),
          pageId,
          i,
          chunk.heading,
          chunk.content,
          chunk.hash,
          embeddingStr,
        );
      }
    }
  });
}

// ── 4. deletePageChunks ────────────────────────────────────────────

export async function deletePageChunks(pageId: string): Promise<void> {
  await prisma.pageChunk.deleteMany({ where: { pageId } });
}

// ── Helpers ────────────────────────────────────────────────────────

function extractText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractText).join(
    node.type === 'paragraph' || node.type === 'listItem' || node.type === 'tableCell' ? '\n' : ' ',
  );
}

function buildPrefix(space: string, page: string, heading: string | null): string {
  const parts = [space, page];
  if (heading) parts.push(heading);
  return `[${parts.join(' > ')}]`;
}

function hashStr(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `c${timestamp}${random}`;
}
