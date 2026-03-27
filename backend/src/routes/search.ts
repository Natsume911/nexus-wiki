import { Router } from 'express';
import * as searchService from '../services/searchService.js';
import * as analyticsService from '../services/searchAnalyticsService.js';
import { success } from '../utils/response.js';

const router = Router();

// GET /api/search?q=&spaceId=&authorId=&tagId=&dateFrom=&dateTo=&mode=
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const mode = req.query.mode as 'semantic' | 'fulltext' | undefined;
    const spaceId = req.query.spaceId as string | undefined;

    const result = await searchService.search(q, {
      spaceId,
      authorId: req.query.authorId as string | undefined,
      tagId: req.query.tagId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      mode,
      userId: req.user?.id,
    });

    // Log search query and attach searchId for click tracking
    if (q.trim()) {
      try {
        const searchId = await analyticsService.logSearch({
          query: q.trim(),
          mode: result.mode,
          resultsCount: result.results.length,
          timingMs: result.timing,
          expandedQuery: result.expandedQuery,
          userId: req.user?.id,
          spaceId,
        });
        (result as unknown as Record<string, unknown>).searchId = searchId;
      } catch { /* analytics failure should not block search */ }
    }

    success(res, result);
  } catch (err) { next(err); }
});

// POST /api/search/click — log search result click
router.post('/click', async (req, res, next) => {
  try {
    const { searchId, pageId } = req.body;
    if (searchId && pageId) {
      await analyticsService.logClick(searchId, pageId);
    }
    success(res, { logged: true });
  } catch (err) { next(err); }
});

// GET /api/search/suggestions?q= — autocomplete suggestions
router.get('/suggestions', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const suggestions = await searchService.searchSuggestions(q);
    success(res, suggestions);
  } catch (err) { next(err); }
});

// GET /api/search/pages?q= — lightweight page search (for [[ links])
router.get('/pages', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await searchService.searchPages(q);
    success(res, results);
  } catch (err) { next(err); }
});

export default router;
