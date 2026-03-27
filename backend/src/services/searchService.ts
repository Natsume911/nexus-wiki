import OpenAI from 'openai';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { embedChunks } from './chunkingService.js';
import { cached, CacheKeys } from './cacheService.js';
import { searchAttachments, type AttachmentSearchResult } from './attachmentSearchService.js';
import { trackFromResponse } from './llmUsageService.js';

// ── Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  headline: string;
  heading: string | null;
  rank: number;
  space: { id: string; name: string; slug: string };
  breadcrumbs: string[];
  type?: 'page' | 'attachment';
  attachmentMeta?: { attachmentId: string; mimeType: string; pageId: string | null };
}

export interface SearchResponse {
  results: SearchResult[];
  mode: 'semantic' | 'fulltext' | 'trigram';
  expandedQuery: string | null;
  timing: number;
  didYouMean: string | null;
}

export interface SearchOptions {
  spaceId?: string;
  authorId?: string;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
  mode?: 'semantic' | 'fulltext';
  titleFilter?: string;
  userId?: string;
}

// ── OpenAI ─────────────────────────────────────────────────────────

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ── Sanitize headline (prevent XSS from ts_headline) ────────────────
// Strip all HTML except <mark> and </mark> used for highlighting.
function sanitizeHeadline(html: string): string {
  // Replace <mark> and </mark> with placeholders
  let safe = html
    .replace(/<mark>/gi, '\x00MARK_OPEN\x00')
    .replace(/<\/mark>/gi, '\x00MARK_CLOSE\x00');
  // Strip all remaining HTML tags
  safe = safe.replace(/<[^>]*>/g, '');
  // Restore <mark> tags
  safe = safe
    .replace(/\x00MARK_OPEN\x00/g, '<mark>')
    .replace(/\x00MARK_CLOSE\x00/g, '</mark>');
  return safe;
}

// ── Query Parser ──────────────────────────────────────────────────
// Supports: "exact phrase", -exclude, NOT, OR, space:, author:, tag:, title:

export interface ParsedQuery {
  textForEmbedding: string;
  tsQuery: string;
  excludeTerms: string[];
  fieldFilters: {
    space?: string;
    author?: string;
    tag?: string;
    title?: string;
  };
  hasOperators: boolean;
}

function sanitizeTsWord(w: string): string {
  return w.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙüöäßçñ]/g, '');
}

export function parseSearchQuery(raw: string): ParsedQuery {
  let query = raw.trim();
  const fieldFilters: ParsedQuery['fieldFilters'] = {};
  const excludeTerms: string[] = [];
  const phrases: string[] = [];
  let hasOperators = false;

  // 1. Extract field operators: space:xxx, author:xxx, tag:xxx, title:xxx
  query = query.replace(/\b(space|author|tag|title):(?:"([^"]+)"|(\S+))/gi, (_, field, quoted, unquoted) => {
    hasOperators = true;
    const value = (quoted || unquoted || '').trim();
    const key = field.toLowerCase() as keyof typeof fieldFilters;
    fieldFilters[key] = value;
    return '';
  });

  // 2. Extract quoted phrases: "exact match"
  query = query.replace(/"([^"]+)"/g, (_, phrase) => {
    hasOperators = true;
    phrases.push(phrase.trim());
    return '';
  });

  // 3. Extract NOT terms and -prefix terms
  query = query.replace(/(?:^|\s)NOT\s+(\w+)/gi, (_, term) => {
    hasOperators = true;
    excludeTerms.push(term.toLowerCase());
    return '';
  });
  query = query.replace(/(?:^|\s)-(\w+)/g, (_, term) => {
    hasOperators = true;
    excludeTerms.push(term.toLowerCase());
    return '';
  });

  // 4. Split remaining by OR
  const cleanQuery = query.replace(/\s+/g, ' ').trim();
  const hasOr = /\s+OR\s+/.test(cleanQuery);
  if (hasOr) hasOperators = true;
  const segments = cleanQuery.split(/\s+OR\s+/).map(s => s.trim()).filter(Boolean);

  // 5. Build tsquery
  const tsQueryParts: string[] = [];

  // Phrases → <-> (followed by)
  for (const phrase of phrases) {
    const words = phrase.split(/\s+/).map(sanitizeTsWord).filter(Boolean);
    if (words.length > 1) {
      tsQueryParts.push(`(${words.join(' <-> ')})`);
    } else if (words.length === 1) {
      tsQueryParts.push(`${words[0]}:*`);
    }
  }

  // OR groups or AND terms
  if (hasOr && segments.length > 1) {
    const orParts = segments.map(seg => {
      const words = seg.split(/\s+/).map(sanitizeTsWord).filter(w => w.length > 0);
      return words.map(w => `${w}:*`).join(' & ');
    }).filter(Boolean);
    if (orParts.length > 0) tsQueryParts.push(`(${orParts.join(' | ')})`);
  } else {
    const allWords = segments.flatMap(seg => seg.split(/\s+/));
    for (const w of allWords) {
      const clean = sanitizeTsWord(w);
      if (clean) tsQueryParts.push(`${clean}:*`);
    }
  }

  // NOT terms → !word:*
  for (const term of excludeTerms) {
    const clean = sanitizeTsWord(term);
    if (clean) tsQueryParts.push(`!${clean}:*`);
  }

  const tsQuery = tsQueryParts.join(' & ');
  const textForEmbedding = [...phrases, ...segments].filter(Boolean).join(' ').trim() || raw.trim();

  return { textForEmbedding, tsQuery, excludeTerms, fieldFilters, hasOperators };
}

async function resolveFieldFilters(
  fieldFilters: ParsedQuery['fieldFilters'],
): Promise<{ spaceId?: string; authorId?: string; tagId?: string; titleFilter?: string }> {
  const resolved: { spaceId?: string; authorId?: string; tagId?: string; titleFilter?: string } = {};

  if (fieldFilters.title) resolved.titleFilter = fieldFilters.title;

  const [space, author, tag] = await Promise.all([
    fieldFilters.space
      ? prisma.space.findFirst({
          where: { OR: [
            { slug: { equals: fieldFilters.space, mode: 'insensitive' } },
            { name: { contains: fieldFilters.space, mode: 'insensitive' } },
          ] },
          select: { id: true },
        })
      : null,
    fieldFilters.author
      ? prisma.user.findFirst({
          where: { OR: [
            { name: { contains: fieldFilters.author, mode: 'insensitive' } },
            { email: { contains: fieldFilters.author, mode: 'insensitive' } },
          ] },
          select: { id: true },
        })
      : null,
    fieldFilters.tag
      ? prisma.tag.findFirst({
          where: { name: { contains: fieldFilters.tag, mode: 'insensitive' } },
          select: { id: true },
        })
      : null,
  ]);

  if (space) resolved.spaceId = space.id;
  if (author) resolved.authorId = author.id;
  if (tag) resolved.tagId = tag.id;

  return resolved;
}

// ── Query Classification ───────────────────────────────────────────
// Classify query intent to choose optimal strategy

type QueryType = 'keyword' | 'question' | 'navigational';

function classifyQuery(query: string): QueryType {
  const q = query.trim().toLowerCase();

  // Navigational: looks like the user wants a specific page
  if (q.length < 4 || /^[a-z0-9\-_.]+$/.test(q)) return 'navigational';

  // Question: starts with interrogative words
  if (/^(come|cosa|dove|quando|perché|chi|quale|quanto|what|how|where|when|why|which|who)[\s?]/i.test(q)) {
    return 'question';
  }

  // If it has 3+ words, it's likely a question/description
  if (q.split(/\s+/).length >= 4) return 'question';

  return 'keyword';
}

// ── HyDE (Hypothetical Document Embedding) ─────────────────────────
// For question-type queries: generate a hypothetical answer, embed THAT
// instead of the raw query. Dramatically better for "how to" queries.

async function hydeGenerate(query: string): Promise<string | null> {
  const ai = getOpenAI();
  if (!ai) return null;

  try {
    const start = Date.now();
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_completion_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Sei un ingegnere IT/SOC/DevOps. Ti viene data una domanda da cercare in una wiki aziendale.
Scrivi un BREVE paragrafo (3-5 frasi) che sarebbe la risposta ideale trovata nella wiki.
Usa termini tecnici specifici, nomi di prodotti, comandi. Mix italiano/inglese tecnico.
NON dire "nella wiki si trova" — scrivi direttamente il contenuto come se fosse un estratto della pagina.`,
        },
        { role: 'user', content: query },
      ],
    });
    trackFromResponse('search-hyde', 'gpt-4o-mini', response, start);
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[searchService] HyDE generation error:', err);
    return null;
  }
}

// ── Query Expansion (for keyword queries) ──────────────────────────

async function expandQuery(query: string): Promise<string | null> {
  const ai = getOpenAI();
  if (!ai) return null;

  const words = query.trim().split(/\s+/);
  if (words.length < 2) return null;

  try {
    const start = Date.now();
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_completion_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `Espandi questa query di ricerca per una wiki IT/SOC/DevOps.
Genera 5-8 termini correlati (sinonimi, acronimi, termini tecnici).
SOLO termini separati da spazio, niente punteggiatura. Mix italiano/inglese.`,
        },
        { role: 'user', content: query },
      ],
    });
    trackFromResponse('search-expand', 'gpt-4o-mini', response, start);
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[searchService] query expansion error:', err);
    return null;
  }
}

// ── Cross-Encoder Re-ranking ───────────────────────────────────────
// After retrieval, use LLM to re-score top N candidates for relevance.
// This is the single biggest quality improvement over raw RRF.

interface RerankerCandidate {
  pageId: string;
  title: string;
  snippet: string;
  heading: string | null;
  originalScore: number;
}

async function rerank(
  query: string,
  candidates: RerankerCandidate[],
  topK = 15,
): Promise<RerankerCandidate[]> {
  const ai = getOpenAI();
  if (!ai || candidates.length <= 3) return candidates;

  // Take top 25 candidates for re-ranking (cost control)
  const toRerank = candidates.slice(0, 25);

  try {
    const numbered = toRerank
      .map((c, i) => `[${i}] ${c.title}${c.heading ? ` > ${c.heading}` : ''}: ${c.snippet.slice(0, 150)}`)
      .join('\n');

    const start = Date.now();
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_completion_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `Sei un sistema di re-ranking per ricerca documentale IT.
Data una query e una lista di risultati numerati, restituisci SOLO i numeri dei risultati più rilevanti, ordinati dal più al meno rilevante.
Formato: numeri separati da virgola, es: "3,0,7,1,5"
Massimo ${topK} risultati. Escludi risultati non pertinenti.`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nRisultati:\n${numbered}`,
        },
      ],
    });
    trackFromResponse('search-rerank', 'gpt-4o-mini', response, start);

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    const indices = content
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < toRerank.length);

    if (indices.length === 0) return candidates.slice(0, topK);

    // Rebuild ranked list
    const seen = new Set<number>();
    const reranked: RerankerCandidate[] = [];
    for (const idx of indices) {
      if (!seen.has(idx)) {
        seen.add(idx);
        reranked.push(toRerank[idx]);
      }
    }

    // Append any remaining candidates not re-ranked
    for (let i = 0; i < toRerank.length && reranked.length < topK; i++) {
      if (!seen.has(i)) reranked.push(toRerank[i]);
    }

    return reranked.slice(0, topK);
  } catch (err) {
    console.error('[searchService] rerank error:', err);
    return candidates.slice(0, topK);
  }
}

// ── "Did You Mean?" ────────────────────────────────────────────────
// When results are empty or sparse, suggest corrections via trigram

async function didYouMean(query: string): Promise<string | null> {
  try {
    const suggestions = await prisma.$queryRawUnsafe<{ title: string; sim: number }[]>(
      `SELECT title, similarity(title, $1) AS sim
       FROM pages
       WHERE deleted_at IS NULL AND archived_at IS NULL AND similarity(title, $1) > 0.15
       ORDER BY sim DESC LIMIT 1`,
      query.trim(),
    );
    if (suggestions.length > 0 && suggestions[0].title.toLowerCase() !== query.trim().toLowerCase()) {
      return suggestions[0].title;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Personalization Boost ──────────────────────────────────────────
// Re-rank results based on user signals: favorites, watches, view frequency, global popularity

async function personalizeResults(
  results: SearchResult[],
  userId?: string,
): Promise<SearchResult[]> {
  if (results.length <= 1) return results;

  const pageIds = results.map(r => r.id);

  // Load user signals + global popularity in parallel
  const [favorites, watches, userViews, globalViews, clickedPages] = await Promise.all([
    userId
      ? prisma.pageFavorite.findMany({ where: { userId, pageId: { in: pageIds } }, select: { pageId: true } })
      : [],
    userId
      ? prisma.pageWatch.findMany({ where: { userId, pageId: { in: pageIds } }, select: { pageId: true } })
      : [],
    userId
      ? prisma.pageView.groupBy({
          by: ['pageId'],
          where: { userId, pageId: { in: pageIds } },
          _count: { pageId: true },
        })
      : [],
    prisma.pageView.groupBy({
      by: ['pageId'],
      where: { pageId: { in: pageIds } },
      _count: { pageId: true },
    }),
    prisma.searchQuery.groupBy({
      by: ['clickedPageId'],
      where: { clickedPageId: { in: pageIds } },
      _count: { clickedPageId: true },
    }),
  ]);

  const favSet = new Set(favorites.map(f => f.pageId));
  const watchSet = new Set(watches.map(w => w.pageId));
  const userViewMap = new Map(userViews.map(v => [v.pageId, v._count.pageId]));
  const globalViewMap = new Map(globalViews.map(v => [v.pageId, v._count.pageId]));
  const clickMap = new Map(clickedPages.map(c => [c.clickedPageId!, c._count.clickedPageId]));

  const maxGlobalViews = Math.max(1, ...Array.from(globalViewMap.values()));
  const maxClicks = Math.max(1, ...Array.from(clickMap.values()));

  // Score each result with personalization boost
  const scored = results.map((r, i) => {
    const positionScore = results.length - i; // original rank weight
    let boost = 0;

    if (favSet.has(r.id)) boost += 3;              // strong signal
    if (watchSet.has(r.id)) boost += 2;             // moderate signal
    const uv = userViewMap.get(r.id) || 0;
    boost += Math.min(uv / 5, 2);                   // up to 2 points for frequent views
    const gv = globalViewMap.get(r.id) || 0;
    boost += (gv / maxGlobalViews) * 1.5;           // up to 1.5 for popularity
    const clicks = clickMap.get(r.id) || 0;
    boost += (clicks / maxClicks) * 1;               // up to 1 for search click-through

    return { result: r, score: positionScore + boost };
  });

  // Sort by boosted score (higher is better)
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.result);
}

// ── Main Search ────────────────────────────────────────────────────

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  if (!query.trim()) {
    return { results: [], mode: 'fulltext', expandedQuery: null, timing: 0, didYouMean: null };
  }

  // Parse operators from query string
  const parsed = parseSearchQuery(query);

  // Resolve field filters (space:xxx, author:xxx, tag:xxx, title:xxx)
  const fieldResolved = parsed.hasOperators ? await resolveFieldFilters(parsed.fieldFilters) : {};

  // Merge: explicit API options override query-embedded field filters
  const merged: SearchOptions = { ...fieldResolved };
  if (options.spaceId) merged.spaceId = options.spaceId;
  if (options.authorId) merged.authorId = options.authorId;
  if (options.tagId) merged.tagId = options.tagId;
  if (options.dateFrom) merged.dateFrom = options.dateFrom;
  if (options.dateTo) merged.dateTo = options.dateTo;
  if (options.mode) merged.mode = options.mode;
  if (options.userId) merged.userId = options.userId;

  const cacheKey = CacheKeys.search(
    createHash('md5').update(JSON.stringify({ query, ...merged })).digest('hex'),
  );

  const rawResult = await cached(cacheKey, 60, async () => {
    const start = Date.now();
    const { spaceId, authorId, tagId, dateFrom, dateTo, mode, titleFilter } = merged;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const useSemanticMode = mode !== 'fulltext' && hasOpenAI;
    const filters = { spaceId, authorId, tagId, dateFrom, dateTo, titleFilter };

    // Try semantic search first
    if (useSemanticMode) {
      try {
        const result = await semanticSearch(parsed, filters);
        result.timing = Date.now() - start;
        if (result.results.length > 0) return result;
      } catch (err) {
        console.error('[searchService] semantic search failed, falling back:', err);
      }
    }

    // Fallback: full-text search (needs a valid tsQuery)
    if (parsed.tsQuery) {
      const ftResults = await fullTextSearch(parsed, filters);
      if (ftResults.length > 0) {
        return {
          results: ftResults,
          mode: 'fulltext' as const,
          expandedQuery: null,
          timing: Date.now() - start,
          didYouMean: null,
        };
      }
    }

    // Final fallback: trigram
    const [triResults, suggestion] = await Promise.all([
      trigramSearch(parsed, filters),
      didYouMean(parsed.textForEmbedding),
    ]);
    return {
      results: triResults,
      mode: 'trigram' as const,
      expandedQuery: null,
      timing: Date.now() - start,
      didYouMean: suggestion,
    };
  });

  // Personalize results per-user (outside cache — user-specific)
  if (merged.userId && rawResult.results.length > 1) {
    rawResult.results = await personalizeResults(rawResult.results, merged.userId);
  }

  return rawResult;
}

// ── Semantic Search ────────────────────────────────────────────────

async function semanticSearch(
  parsed: ParsedQuery,
  filters: Omit<SearchOptions, 'mode' | 'userId'>,
): Promise<SearchResponse> {
  const query = parsed.textForEmbedding;
  const queryType = classifyQuery(query);

  let expandedTerms: string | null = null;
  let embeddingText: string;

  // Fast path: embed the query directly first (no LLM calls)
  // HyDE and expansion run in parallel but don't block the initial embedding
  const directEmbeddingPromise = embedChunks([query]);

  if (queryType === 'question' && query.trim().split(/\s+/).length >= 5) {
    // HyDE only for long questions (5+ words) — adds ~2s latency
    const [hydeDoc, expansion] = await Promise.all([
      hydeGenerate(query),
      expandQuery(query),
    ]);
    embeddingText = hydeDoc || query;
    expandedTerms = expansion;
  } else if (queryType === 'question') {
    // Short questions: just expand, no HyDE
    expandedTerms = await expandQuery(query);
    embeddingText = expandedTerms ? `${query} ${expandedTerms}` : query;
  } else if (queryType === 'keyword' && query.trim().split(/\s+/).length >= 3) {
    // Only expand multi-word keyword queries (skip for short navigational)
    expandedTerms = await expandQuery(query);
    embeddingText = expandedTerms ? `${query} ${expandedTerms}` : query;
  } else {
    // Navigational or short keyword: embed directly, no LLM calls → fastest path
    embeddingText = query;
  }

  // Use HyDE/expanded embedding if available, otherwise fall back to direct embedding
  const queryEmbeddings = embeddingText !== query
    ? await embedChunks([embeddingText])
    : await directEmbeddingPromise;
  if (!queryEmbeddings || queryEmbeddings.length === 0) {
    return { results: [], mode: 'semantic', expandedQuery: expandedTerms, timing: 0, didYouMean: null };
  }

  // Build full-text query for hybrid search using parsed operators
  let tsQuery = parsed.tsQuery;
  if (expandedTerms) {
    const expandedTsTerms = expandedTerms.split(/\s+/)
      .map(w => `${w.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙüöäßçñ]/g, '')}:*`)
      .filter(w => w.length > 2)
      .join(' | ');
    if (tsQuery && expandedTsTerms) {
      tsQuery = `(${tsQuery}) | ${expandedTsTerms}`;
    } else if (expandedTsTerms) {
      tsQuery = expandedTsTerms;
    }
  }

  const embeddingStr = `[${queryEmbeddings[0].join(',')}]`;

  // Hybrid search: RRF fusion of full-text + vector
  const rawChunks = await prisma.$queryRawUnsafe<
    {
      chunk_id: string;
      page_id: string;
      heading: string | null;
      content: string;
      chunk_index: number;
      rrf_score: number;
      ft_rank: number;
      vec_distance: number;
    }[]
  >(
    `SELECT * FROM hybrid_search($1::vector, $2, 50, 60, $3)`,
    embeddingStr,
    tsQuery || 'placeholder_no_match:*',
    filters.spaceId ?? null,
  );

  // Group chunks by page (best chunk per page)
  const pageMap = new Map<string, {
    pageId: string; heading: string | null; content: string; score: number;
  }>();
  for (const chunk of rawChunks) {
    const existing = pageMap.get(chunk.page_id);
    if (!existing || chunk.rrf_score > existing.score) {
      pageMap.set(chunk.page_id, {
        pageId: chunk.page_id,
        heading: chunk.heading,
        content: chunk.content,
        score: chunk.rrf_score,
      });
    }
  }

  if (pageMap.size === 0) {
    return { results: [], mode: 'semantic', expandedQuery: expandedTerms, timing: 0, didYouMean: null };
  }

  // Fetch page metadata
  const pageIds = Array.from(pageMap.keys());
  const pages = await prisma.page.findMany({
    where: {
      id: { in: pageIds },
      deletedAt: null,
      archivedAt: null,
      ...(filters.authorId ? { authorId: filters.authorId } : {}),
      ...(filters.tagId ? { tags: { some: { tagId: filters.tagId } } } : {}),
      ...(filters.dateFrom ? { updatedAt: { gte: new Date(filters.dateFrom) } } : {}),
      ...(filters.dateTo ? { updatedAt: { lte: new Date(filters.dateTo) } } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      space: { select: { id: true, name: true, slug: true } },
    },
  });

  const pageInfoMap = new Map(pages.map((p) => [p.id, p]));

  // Build candidate list for re-ranking
  const candidates: RerankerCandidate[] = [];
  const sortedEntries = Array.from(pageMap.entries()).sort((a, b) => b[1].score - a[1].score);

  for (const [pageId, chunk] of sortedEntries) {
    const page = pageInfoMap.get(pageId);
    if (!page) continue;

    let snippet = chunk.content;
    const prefixEnd = snippet.indexOf(']\n');
    if (prefixEnd !== -1) snippet = snippet.slice(prefixEnd + 2);

    candidates.push({
      pageId,
      title: page.title,
      snippet,
      heading: chunk.heading,
      originalScore: chunk.score,
    });
  }

  // Re-rank with cross-encoder (skip for navigational queries — fast path)
  const reranked = queryType === 'navigational' || candidates.length <= 5
    ? candidates.slice(0, 20)
    : await rerank(query, candidates, 20);

  // Convert page results to SearchResult
  const results: SearchResult[] = reranked.map((c, i) => {
    const page = pageInfoMap.get(c.pageId)!;
    let headline = c.snippet;
    if (headline.length > 200) headline = headline.slice(0, 200) + '…';

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      headline,
      heading: c.heading,
      rank: reranked.length - i,
      space: page.space,
      breadcrumbs: [],
      type: 'page' as const,
    };
  });

  // Also search attachment content (fire in parallel, append at end)
  try {
    const attResults = await searchAttachments(queryEmbeddings[0], 5, filters.spaceId);
    for (const att of attResults) {
      if (att.score > 0.3) { // only include reasonably relevant matches
        results.push({
          id: att.attachmentId,
          title: `📎 ${att.originalName}`,
          slug: '',
          headline: att.snippet,
          heading: null,
          rank: 0,
          space: { id: att.spaceId, name: att.spaceName, slug: att.spaceSlug },
          breadcrumbs: [],
          type: 'attachment',
          attachmentMeta: { attachmentId: att.attachmentId, mimeType: att.mimeType, pageId: att.pageId },
        });
      }
    }
  } catch { /* attachment search failure shouldn't block main results */ }

  // Apply post-filters for operators not handled by SQL
  let filteredResults = results;

  // Exclude terms (NOT / -) — vector search doesn't know about NOT
  if (parsed.excludeTerms.length > 0) {
    filteredResults = filteredResults.filter(r => {
      const text = `${r.title} ${r.headline}`.toLowerCase();
      return !parsed.excludeTerms.some(term => text.includes(term));
    });
  }

  // Title filter (title:keyword)
  if (parsed.fieldFilters.title) {
    const titleLower = parsed.fieldFilters.title.toLowerCase();
    filteredResults = filteredResults.filter(r => r.title.toLowerCase().includes(titleLower));
  }

  return {
    results: filteredResults,
    mode: 'semantic',
    expandedQuery: expandedTerms,
    timing: 0,
    didYouMean: null,
  };
}

// ── Full-Text Search ───────────────────────────────────────────────

async function fullTextSearch(
  parsed: ParsedQuery,
  filters: Omit<SearchOptions, 'mode' | 'userId'>,
): Promise<SearchResult[]> {
  const tsQuery = parsed.tsQuery;
  if (!tsQuery) return [];

  const conditions: string[] = [
    "p.search_vector @@ to_tsquery('italian', $1)",
    'p.deleted_at IS NULL',
    'p.archived_at IS NULL',
  ];
  const params: unknown[] = [tsQuery];
  let paramIdx = 2;

  if (filters.spaceId) {
    conditions.push(`p.space_id = $${paramIdx}`);
    params.push(filters.spaceId);
    paramIdx++;
  }
  if (filters.authorId) {
    conditions.push(`p.author_id = $${paramIdx}`);
    params.push(filters.authorId);
    paramIdx++;
  }
  if (filters.dateFrom) {
    conditions.push(`p.updated_at >= $${paramIdx}::timestamptz`);
    params.push(filters.dateFrom);
    paramIdx++;
  }
  if (filters.dateTo) {
    conditions.push(`p.updated_at <= $${paramIdx}::timestamptz`);
    params.push(filters.dateTo);
    paramIdx++;
  }
  if (filters.titleFilter) {
    conditions.push(`p.title ILIKE $${paramIdx}`);
    params.push(`%${filters.titleFilter.replace(/[%_]/g, '\\$&')}%`);
    paramIdx++;
  }

  const tagJoin = filters.tagId
    ? `JOIN page_tags pt ON pt.page_id = p.id AND pt.tag_id = $${paramIdx}`
    : '';
  if (filters.tagId) {
    params.push(filters.tagId);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const rows = await prisma.$queryRawUnsafe<SearchResult[]>(
    `SELECT
      p.id,
      p.title,
      p.slug,
      ts_headline('italian', p.title || ' ' || coalesce(extract_text_from_json(p.content), ''),
        to_tsquery('italian', $1),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2'
      ) as headline,
      NULL as heading,
      ts_rank(p.search_vector, to_tsquery('italian', $1)) as rank,
      json_build_object('id', s.id, 'name', s.name, 'slug', s.slug) as space
    FROM pages p
    JOIN spaces s ON s.id = p.space_id
    ${tagJoin}
    WHERE ${whereClause}
    ORDER BY rank DESC
    LIMIT 20`,
    ...params,
  );

  for (const row of rows) {
    row.headline = sanitizeHeadline(row.headline);
  }
  return rows;
}

// ── Trigram Search (fuzzy fallback) ────────────────────────────────

async function trigramSearch(
  parsed: ParsedQuery,
  filters: Omit<SearchOptions, 'mode' | 'userId'>,
): Promise<SearchResult[]> {
  const queryText = parsed.textForEmbedding;
  const conditions: string[] = ['similarity(p.title, $1) > 0.1', 'p.deleted_at IS NULL', 'p.archived_at IS NULL'];
  const params: unknown[] = [queryText];
  let paramIdx = 2;

  if (filters.spaceId) {
    conditions.push(`p.space_id = $${paramIdx}`);
    params.push(filters.spaceId);
    paramIdx++;
  }
  if (filters.authorId) {
    conditions.push(`p.author_id = $${paramIdx}`);
    params.push(filters.authorId);
    paramIdx++;
  }
  if (filters.dateFrom) {
    conditions.push(`p.updated_at >= $${paramIdx}::timestamptz`);
    params.push(filters.dateFrom);
    paramIdx++;
  }
  if (filters.dateTo) {
    conditions.push(`p.updated_at <= $${paramIdx}::timestamptz`);
    params.push(filters.dateTo);
    paramIdx++;
  }
  if (filters.titleFilter) {
    conditions.push(`p.title ILIKE $${paramIdx}`);
    params.push(`%${filters.titleFilter.replace(/[%_]/g, '\\$&')}%`);
    paramIdx++;
  }

  const tagJoin = filters.tagId
    ? `JOIN page_tags pt ON pt.page_id = p.id AND pt.tag_id = $${paramIdx}`
    : '';
  if (filters.tagId) {
    params.push(filters.tagId);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const rows = await prisma.$queryRawUnsafe<SearchResult[]>(
    `SELECT
      p.id,
      p.title,
      p.slug,
      p.title as headline,
      NULL as heading,
      similarity(p.title, $1) as rank,
      json_build_object('id', s.id, 'name', s.name, 'slug', s.slug) as space
    FROM pages p
    JOIN spaces s ON s.id = p.space_id
    ${tagJoin}
    WHERE ${whereClause}
    ORDER BY rank DESC
    LIMIT 20`,
    ...params,
  );

  // Apply post-filters for operators not handled by trigram SQL
  let filteredRows = rows;
  if (parsed.excludeTerms.length > 0) {
    filteredRows = filteredRows.filter(r => {
      const text = r.title.toLowerCase();
      return !parsed.excludeTerms.some(term => text.includes(term));
    });
  }

  return filteredRows;
}

// ── Suggestions (autocomplete) ─────────────────────────────────────

export async function searchSuggestions(query: string, limit = 5): Promise<string[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  const results = await prisma.$queryRawUnsafe<{ title: string }[]>(
    `SELECT title FROM (
       SELECT DISTINCT ON (title) title, length(title) AS len
       FROM pages
       WHERE deleted_at IS NULL AND archived_at IS NULL AND title ILIKE $1
     ) sub
     ORDER BY len ASC
     LIMIT $2`,
    `%${query.trim().replace(/[%_]/g, '\\$&')}%`,
    limit,
  );
  return results.map((r) => r.title);
}

// ── Page Search (for [[ links) ─────────────────────────────────────

export async function searchPages(query: string, limit = 10) {
  if (!query.trim()) return [];

  return prisma.page.findMany({
    where: {
      title: { contains: query, mode: 'insensitive' },
      deletedAt: null,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      space: { select: { id: true, name: true, slug: true } },
    },
    take: limit,
  });
}
