import { Router } from 'express';
import { uploadLarge } from '../middleware/upload.js';
import { transcribeAudio, generateMeetingNotes } from '../services/meetingNotesService.js';
import { success, error } from '../utils/response.js';
import fs from 'fs';

const router = Router();

// POST /api/meeting/transcribe — upload audio, transcribe, generate notes
router.post('/meeting/transcribe', uploadLarge.single('audio'), async (req, res, next) => {
  // Long timeout for big recordings — processing can take 30+ min
  req.setTimeout(3600_000); // 1 hour
  res.setTimeout(3600_000);
  try {
    if (!process.env.OPENAI_API_KEY) {
      return error(res, 'OPENAI_API_KEY non configurata sul server', 500);
    }

    if (!req.file) {
      return error(res, 'Nessun file audio caricato', 400);
    }

    // 1. Transcribe audio with Whisper
    const transcript = await transcribeAudio(req.file.path);

    // 2. Generate structured meeting notes with GPT-4o
    const { content } = await generateMeetingNotes(transcript);

    // 3. Build audio URL for optional playback
    const audioUrl = `/wiki/uploads/${req.file.path.replace(/^\/uploads\/?/, '')}`;

    success(res, { transcript, content, audioUrl });
  } catch (err: any) {
    // Clean up temp file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    // Surface OpenAI errors clearly
    if (err?.status || err?.code) {
      return error(res, `Errore OpenAI: ${err.message}`, 502);
    }

    next(err);
  }
});

export default router;
