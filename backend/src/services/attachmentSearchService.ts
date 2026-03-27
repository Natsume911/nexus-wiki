import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { embedChunks } from './chunkingService.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';
const TARGET_CHUNK_CHARS = 1600;

// ── Text extraction ──────────────────────────────────────────────

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string | null> {
  try {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    const buffer = await fs.readFile(fullPath);

    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text?.trim() || null;
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.trim() || null;
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
      return buffer.toString('utf-8').trim() || null;
    }

    return null;
  } catch (err) {
    console.error(`[attachmentSearch] Failed to extract text from ${filePath}:`, err);
    return null;
  }
}

// ── Chunking ─────────────────────────────────────────────────────

interface Chunk {
  content: string;
  hash: string;
}

function chunkText(prefix: string, text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
  let current = prefix + '\n';

  for (const para of paragraphs) {
    if (current.length + para.length > TARGET_CHUNK_CHARS && current.length > prefix.length + 1) {
      chunks.push({ content: current, hash: hashStr(current) });
      current = prefix + '\n';
    }
    current += para + '\n';
  }

  if (current.length > prefix.length + 1) {
    chunks.push({ content: current, hash: hashStr(current) });
  }

  if (chunks.length === 0) {
    const full = `${prefix}\n${text.slice(0, TARGET_CHUNK_CHARS)}`;
    chunks.push({ content: full, hash: hashStr(full) });
  }

  return chunks;
}

function hashStr(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `c${timestamp}${random}`;
}

// ── Sync attachment chunks ───────────────────────────────────────

export async function syncAttachmentChunks(attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { space: { select: { name: true } } },
  });
  if (!attachment) return;

  // Extract text
  const text = await extractTextFromFile(attachment.path, attachment.mimeType);
  if (!text) {
    // No extractable text — clean up any old chunks
    await prisma.attachmentChunk.deleteMany({ where: { attachmentId } });
    return;
  }

  // Save extracted text to attachment
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { textContent: text.slice(0, 100000) }, // limit stored text
  });

  const prefix = `[${attachment.space.name} > 📎 ${attachment.originalName}]`;
  const newChunks = chunkText(prefix, text);

  // Get existing chunks for diff
  const existing = await prisma.attachmentChunk.findMany({
    where: { attachmentId },
    select: { id: true, chunkIndex: true, contentHash: true },
    orderBy: { chunkIndex: 'asc' },
  });
  const existingByIndex = new Map(existing.map(c => [c.chunkIndex, c]));

  // Determine which chunks need embedding
  const toEmbed: { index: number; content: string }[] = [];
  for (let i = 0; i < newChunks.length; i++) {
    const ex = existingByIndex.get(i);
    if (!ex || ex.contentHash !== newChunks[i].hash) {
      toEmbed.push({ index: i, content: newChunks[i].content });
    }
  }

  // Embed new/changed chunks
  let embeddings: number[][] | null = null;
  if (toEmbed.length > 0) {
    embeddings = await embedChunks(toEmbed.map(t => t.content));
  }

  // Upsert chunks
  await prisma.$transaction(async (tx) => {
    // Delete excess old chunks
    if (existing.length > newChunks.length) {
      await tx.attachmentChunk.deleteMany({
        where: { attachmentId, chunkIndex: { gte: newChunks.length } },
      });
    }

    for (let i = 0; i < newChunks.length; i++) {
      const chunk = newChunks[i];
      const embIdx = toEmbed.findIndex(t => t.index === i);
      const needsUpdate = embIdx !== -1;

      if (needsUpdate) {
        const embedding = embeddings?.[embIdx] ?? null;
        const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

        await tx.$executeRawUnsafe(
          `INSERT INTO attachment_chunks (id, attachment_id, chunk_index, content, content_hash, embedding, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6::vector, NOW(), NOW())
           ON CONFLICT (attachment_id, chunk_index) DO UPDATE SET
             content = EXCLUDED.content,
             content_hash = EXCLUDED.content_hash,
             embedding = EXCLUDED.embedding,
             updated_at = NOW()`,
          existingByIndex.get(i)?.id ?? generateCuid(),
          attachmentId,
          i,
          chunk.content,
          chunk.hash,
          embeddingStr,
        );
      }
    }
  });
}

// ── Delete attachment chunks ─────────────────────────────────────

export async function deleteAttachmentChunks(attachmentId: string): Promise<void> {
  await prisma.attachmentChunk.deleteMany({ where: { attachmentId } });
}

// ── Reindex all attachments ──────────────────────────────────────

export async function reindexAllAttachments(): Promise<{ processed: number; indexed: number }> {
  const attachments = await prisma.attachment.findMany({
    where: {
      mimeType: {
        in: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
          'text/markdown',
          'text/csv',
        ],
      },
    },
    select: { id: true },
  });

  let indexed = 0;
  for (const att of attachments) {
    try {
      await syncAttachmentChunks(att.id);
      indexed++;
    } catch (err) {
      console.error(`[attachmentSearch] Failed to reindex attachment ${att.id}:`, err);
    }
  }

  return { processed: attachments.length, indexed };
}

// ── Search attachments (vector similarity) ───────────────────────

export interface AttachmentSearchResult {
  id: string;
  attachmentId: string;
  originalName: string;
  mimeType: string;
  snippet: string;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  pageId: string | null;
  score: number;
}

export async function searchAttachments(
  queryEmbedding: number[],
  limit = 5,
  spaceId?: string,
): Promise<AttachmentSearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const spaceFilter = spaceId ? `AND a.space_id = $2` : '';
  const params: unknown[] = [embeddingStr];
  if (spaceId) params.push(spaceId);

  const rows = await prisma.$queryRawUnsafe<{
    chunk_id: string;
    attachment_id: string;
    original_name: string;
    mime_type: string;
    content: string;
    space_id: string;
    space_name: string;
    space_slug: string;
    page_id: string | null;
    distance: number;
  }[]>(
    `SELECT
      ac.id AS chunk_id,
      a.id AS attachment_id,
      a.original_name,
      a.mime_type,
      ac.content,
      s.id AS space_id,
      s.name AS space_name,
      s.slug AS space_slug,
      a.page_id,
      ac.embedding <=> $1::vector AS distance
    FROM attachment_chunks ac
    JOIN attachments a ON a.id = ac.attachment_id
    JOIN spaces s ON s.id = a.space_id
    WHERE ac.embedding IS NOT NULL ${spaceFilter}
    ORDER BY distance ASC
    LIMIT ${limit}`,
    ...params,
  );

  // Group by attachment (best chunk per attachment)
  const seen = new Set<string>();
  const results: AttachmentSearchResult[] = [];
  for (const row of rows) {
    if (seen.has(row.attachment_id)) continue;
    seen.add(row.attachment_id);

    let snippet = row.content;
    const prefixEnd = snippet.indexOf(']\n');
    if (prefixEnd !== -1) snippet = snippet.slice(prefixEnd + 2);
    if (snippet.length > 200) snippet = snippet.slice(0, 200) + '…';

    results.push({
      id: row.chunk_id,
      attachmentId: row.attachment_id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      snippet,
      spaceId: row.space_id,
      spaceName: row.space_name,
      spaceSlug: row.space_slug,
      pageId: row.page_id,
      score: 1 - row.distance,
    });
  }

  return results;
}
