import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import { updatePageContent } from './pageService.js';
import { trackFromResponse } from './llmUsageService.js';

const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'gpt-4o-mini';
const BATCH_CHAR_LIMIT = 15000;  // ~4k tokens per batch — gpt-4o-mini handles 128k
const SEPARATOR = '\n[###]\n';
const CONCURRENCY = 5;  // parallel API calls

/** Node types whose text content should NOT be translated */
const SKIP_NODE_TYPES = new Set([
  'codeBlock',
  'image',
  'mermaid',
  'katex',
  'horizontalRule',
  'tableOfContents',
  'statusBadge',
]);

interface TextEntry {
  path: number[];
  text: string;
}

/**
 * Recursively walk TipTap JSON and collect text node paths + values.
 * Skips nodes in SKIP_NODE_TYPES entirely.
 */
function collectTextNodes(node: any, path: number[], entries: TextEntry[]): void {
  if (!node) return;

  if (SKIP_NODE_TYPES.has(node.type)) return;

  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) {
    entries.push({ path: [...path], text: node.text });
    return;
  }

  if (Array.isArray(node.content)) {
    for (let i = 0; i < node.content.length; i++) {
      collectTextNodes(node.content[i], [...path, i], entries);
    }
  }
}

/**
 * Set a text node's value at a given path inside the doc.
 */
function setTextAtPath(doc: any, path: number[], newText: string): void {
  let current = doc;
  for (let i = 0; i < path.length; i++) {
    current = current.content[path[i]];
  }
  current.text = newText;
}

/**
 * Group text entries into batches of ~BATCH_CHAR_LIMIT characters.
 */
function batchEntries(entries: TextEntry[]): TextEntry[][] {
  const batches: TextEntry[][] = [];
  let currentBatch: TextEntry[] = [];
  let currentSize = 0;

  for (const entry of entries) {
    const entrySize = entry.text.length + SEPARATOR.length;
    if (currentBatch.length > 0 && currentSize + entrySize > BATCH_CHAR_LIMIT) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }
    currentBatch.push(entry);
    currentSize += entrySize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Send a batch of texts to GPT for translation.
 */
async function translateBatch(
  openai: OpenAI,
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const userMessage = texts.join(SEPARATOR);

  const start = Date.now();
  const response = await openai.chat.completions.create({
    model: TRANSLATE_MODEL,
    temperature: 0.2,
    max_completion_tokens: 8192,
    messages: [
      {
        role: 'system',
        content: `Sei un traduttore professionista. Traduci il testo in ${targetLang}.
Mantieni **bold**, *italic*, ~~strikethrough~~, \`code\` e altri markers di formattazione inline esattamente come sono.
NON tradurre nomi propri, acronimi, URL, indirizzi email o nomi di comandi/tool.
Ogni sezione è separata dal marcatore [###]. Rispondi SOLO con le traduzioni separate dallo STESSO marcatore [###].
NON aggiungere commenti, spiegazioni o prefissi. Rispondi esattamente con lo stesso numero di sezioni.`,
      },
      { role: 'user', content: userMessage },
    ],
  });
  trackFromResponse('translate', TRANSLATE_MODEL, response, start);

  const result = response.choices[0]?.message?.content?.trim() || '';
  const translated = result.split(/\[###\]/).map(s => s.trim());

  // If the model returned a different number of sections, fall back to originals for missing ones
  return texts.map((original, i) => translated[i]?.trim() || original);
}

/**
 * Translate an entire TipTap document JSON to a target language.
 */
export async function translateTipTapDoc(doc: any, targetLang: string): Promise<any> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Deep clone to avoid mutating the original
  const translated = JSON.parse(JSON.stringify(doc));

  // 1. Collect all text nodes
  const entries: TextEntry[] = [];
  collectTextNodes(translated, [], entries);

  if (entries.length === 0) return translated;

  // 2. Batch them
  const batches = batchEntries(entries);

  // 3. Translate batches in parallel (max 3 concurrent)
  // Use module-level CONCURRENCY constant
  const batchResults: string[][] = new Array(batches.length);

  for (let start = 0; start < batches.length; start += CONCURRENCY) {
    const slice = batches.slice(start, start + CONCURRENCY);
    const results = await Promise.all(
      slice.map((batch) => translateBatch(openai, batch.map(e => e.text), targetLang)),
    );
    for (let j = 0; j < results.length; j++) {
      batchResults[start + j] = results[j];
    }
  }

  // 4. Write back translated texts
  let entryIndex = 0;
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const translatedTexts = batchResults[b];
    for (let i = 0; i < batch.length; i++) {
      setTextAtPath(translated, batch[i].path, translatedTexts[i]);
      entryIndex++;
    }
  }

  return translated;
}

/**
 * Main entry point: translate a page to a target language.
 * Creates a version snapshot before translating.
 */
export async function translatePage(
  pageId: string,
  targetLang: string,
  userId: string,
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY non configurata sul server. Contatta l\'amministratore.');
  }

  // Load the page
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, content: true },
  });

  if (!page) throw new Error('Pagina non trovata');
  if (!page.content) throw new Error('La pagina non ha contenuto da tradurre');

  // Force-create a version snapshot (regardless of 5-min cooldown)
  await prisma.pageVersion.create({
    data: {
      pageId: page.id,
      title: page.title,
      content: page.content as object,
      editedById: userId,
    },
  });

  // Translate the TipTap JSON
  const translatedContent = await translateTipTapDoc(page.content, targetLang);

  // Save the translated content
  // Pass undefined as userId to skip the auto-version logic (we already saved one)
  await updatePageContent(page.id, translatedContent, undefined);
}
