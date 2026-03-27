import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireSpaceAccess } from '../middleware/permissions.js';
import { translatePage, translateTipTapDoc } from '../services/translateService.js';
import { prisma } from '../lib/prisma.js';
import { success, error } from '../utils/response.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

const VALID_LANGUAGES = [
  'italian', 'english', 'albanian', 'french', 'german', 'spanish', 'portuguese',
];

const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste di traduzione, riprova tra poco' },
});

// POST /api/pages/:id/translate
router.post(
  '/pages/:id/translate',
  translateLimiter,
  requireSpaceAccess('EDITOR'),
  async (req, res, next) => {
    try {
      const { targetLang } = req.body;

      if (!targetLang || typeof targetLang !== 'string' || !VALID_LANGUAGES.includes(targetLang)) {
        return error(res, `Lingua non valida. Usa: ${VALID_LANGUAGES.join(', ')}`, 400);
      }

      const pageId = req.params.id as string;
      const user = (req as any).user;

      await translatePage(pageId, targetLang, user.id);

      logAudit(req, {
        action: 'UPDATE',
        resourceType: 'PAGE',
        resourceId: pageId,
        resourceTitle: `translate → ${targetLang}`,
      }).catch(() => {});

      success(res, { success: true });
    } catch (err: any) {
      if (err?.message?.includes('OPENAI_API_KEY')) {
        return error(res, err.message, 500);
      }
      if (err?.message?.includes('non trovata') || err?.message?.includes('non ha contenuto')) {
        return error(res, err.message, 404);
      }
      if (err?.status || err?.code) {
        return error(res, `Errore OpenAI: ${err.message}`, 502);
      }
      next(err);
    }
  },
);

// POST /api/pages/:id/translate/preview — translate without saving (live preview)
router.post(
  '/pages/:id/translate/preview',
  translateLimiter,
  async (req, res, next) => {
    try {
      const { targetLang } = req.body;

      if (!targetLang || typeof targetLang !== 'string' || !VALID_LANGUAGES.includes(targetLang)) {
        return error(res, `Lingua non valida. Usa: ${VALID_LANGUAGES.join(', ')}`, 400);
      }

      const pageId = req.params.id as string;

      if (!process.env.OPENAI_API_KEY) {
        return error(res, 'OPENAI_API_KEY non configurata', 500);
      }

      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { title: true, content: true },
      });
      if (!page) return error(res, 'Pagina non trovata', 404);
      if (!page.content) return error(res, 'La pagina non ha contenuto', 404);

      const translatedContent = await translateTipTapDoc(page.content, targetLang);

      success(res, { content: translatedContent, title: page.title });
    } catch (err: any) {
      if (err?.status || err?.code) {
        return error(res, `Errore OpenAI: ${err.message}`, 502);
      }
      next(err);
    }
  },
);

export default router;
