import { Router } from 'express';
import { processAiWriting } from '../services/aiWritingService.js';
import type { AiAction } from '../services/aiWritingService.js';
import { success, error } from '../utils/response.js';

const router = Router();

const VALID_ACTIONS: AiAction[] = [
  'improve', 'fix', 'summarize', 'translate', 'tone',
  'continue', 'longer', 'shorter', 'simplify', 'explain',
];

// POST /api/ai/write — AI writing assistant
router.post('/ai/write', async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return error(res, 'OPENAI_API_KEY non configurata sul server', 500);
    }

    const { action, text, targetLang, tone, context } = req.body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return error(res, `Azione non valida. Usa: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return error(res, 'Testo mancante', 400);
    }

    if (text.length > 50000) {
      return error(res, 'Testo troppo lungo (max 50000 caratteri)', 400);
    }

    const result = await processAiWriting({ action, text, targetLang, tone, context });
    success(res, { result });
  } catch (err: any) {
    if (err?.status || err?.code) {
      return error(res, `Errore OpenAI: ${err.message}`, 502);
    }
    next(err);
  }
});

export default router;
