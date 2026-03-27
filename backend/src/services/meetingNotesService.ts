import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { trackFromResponse, trackLlmCall } from './llmUsageService.js';
import OpenAI from 'openai';

const execFileAsync = promisify(execFile);

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurata');
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) { return (getOpenAI() as unknown as Record<string | symbol, unknown>)[prop]; },
});

// ── Constants ─────────────────────────────────────────────────────
const MAX_WHISPER_SIZE = 24 * 1024 * 1024; // 24MB (Whisper limit is 25MB, leave margin)
const SEGMENT_DURATION = 600; // 10 minutes per chunk — safe for 24MB at most bitrates

// ── Audio splitting ───────────────────────────────────────────────
// Splits large audio files into ≤24MB chunks using ffmpeg

async function splitAudioIfNeeded(filePath: string): Promise<string[]> {
  const stat = await fsp.stat(filePath);

  // Small enough → no split needed
  if (stat.size <= MAX_WHISPER_SIZE) {
    return [filePath];
  }

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const pattern = path.join(dir, `${base}_chunk_%03d${ext}`);

  // Split into segments of SEGMENT_DURATION seconds
  await execFileAsync('ffmpeg', [
    '-i', filePath,
    '-f', 'segment',
    '-segment_time', String(SEGMENT_DURATION),
    '-c', 'copy',         // no re-encoding, fast
    '-reset_timestamps', '1',
    '-y',                  // overwrite
    pattern,
  ], { timeout: 300_000 }); // 5 min timeout for split

  // Find all chunk files
  const files = await fsp.readdir(dir);
  const chunks = files
    .filter(f => f.startsWith(`${base}_chunk_`) && f.endsWith(ext))
    .sort()
    .map(f => path.join(dir, f));

  if (chunks.length === 0) {
    // Fallback: split failed, try with re-encoding to smaller mp3
    const mp3Pattern = path.join(dir, `${base}_chunk_%03d.mp3`);
    await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-f', 'segment',
      '-segment_time', String(SEGMENT_DURATION),
      '-ac', '1',          // mono
      '-ar', '16000',      // 16kHz (Whisper optimal)
      '-b:a', '32k',       // 32kbps — very small
      '-reset_timestamps', '1',
      '-y',
      mp3Pattern,
    ], { timeout: 600_000 });

    const mp3Files = (await fsp.readdir(dir))
      .filter(f => f.startsWith(`${base}_chunk_`) && f.endsWith('.mp3'))
      .sort()
      .map(f => path.join(dir, f));

    return mp3Files.length > 0 ? mp3Files : [filePath];
  }

  return chunks;
}

// ── Cleanup chunk files ───────────────────────────────────────────

async function cleanupChunks(chunks: string[], originalPath: string): Promise<void> {
  for (const chunk of chunks) {
    if (chunk !== originalPath) {
      await fsp.unlink(chunk).catch(() => {});
    }
  }
}

// ── Transcribe audio (handles any size) ───────────────────────────

export async function transcribeAudio(filePath: string): Promise<string> {
  const chunks = await splitAudioIfNeeded(filePath);
  const transcripts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[meetingNotes] Transcribing chunk ${i + 1}/${chunks.length}: ${path.basename(chunks[i])}`);
    const start = Date.now();
    const file = fs.createReadStream(chunks[i]);
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'text',
    });
    const text = response as unknown as string;
    // Estimate Whisper cost: ~$0.006/min, rough estimate from file duration
    trackLlmCall({
      service: 'whisper',
      model: 'whisper-1',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: text.length,
      durationMs: Date.now() - start,
      metadata: { chunkFile: path.basename(chunks[i]) },
    }).catch(() => {});
    transcripts.push(text);
  }

  // Cleanup temp chunk files
  await cleanupChunks(chunks, filePath);

  return transcripts.join('\n\n');
}

// ── Generate meeting notes (handles long transcripts) ─────────────

interface MeetingNotesStructured {
  summary: string[];
  participants: string[];
  decisions: string[];
  actionItems: string[];
  nextSteps: string[];
}

const NOTES_SYSTEM_PROMPT = `Sei un assistente che analizza trascrizioni di riunioni e genera note strutturate in italiano.
Rispondi SEMPRE in formato JSON con questa struttura esatta:
{
  "summary": ["punto 1", "punto 2", ...],
  "participants": ["Nome 1", "Nome 2", ...],
  "decisions": ["decisione 1", "decisione 2", ...],
  "actionItems": ["Responsabile: descrizione azione — scadenza", ...],
  "nextSteps": ["passo 1", "passo 2", ...]
}
Se non riesci a identificare partecipanti, inserisci ["Non identificati"].
Se non ci sono decisioni o action items, inserisci un array vuoto.
Sii conciso ma completo. Ogni punto del riassunto deve essere una frase chiara.`;

// ~3000 words ≈ ~4000 tokens — safe chunk size for context window
const TRANSCRIPT_CHUNK_CHARS = 12000;

async function summarizeTranscriptChunk(chunk: string, chunkIdx: number, totalChunks: number): Promise<MeetingNotesStructured> {
  const label = totalChunks > 1 ? ` (parte ${chunkIdx + 1}/${totalChunks})` : '';
  const start = Date.now();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: NOTES_SYSTEM_PROMPT },
      { role: 'user', content: `Analizza questa trascrizione di riunione${label} e genera le note strutturate:\n\n${chunk}` },
    ],
  });
  trackFromResponse('meeting-notes', 'gpt-4o', response, start);

  const raw = response.choices[0]?.message?.content || '{}';
  return JSON.parse(raw);
}

async function mergeNotes(parts: MeetingNotesStructured[]): Promise<MeetingNotesStructured> {
  if (parts.length === 1) return parts[0];

  // Merge all parts, then ask LLM to deduplicate and consolidate
  const merged: MeetingNotesStructured = {
    summary: parts.flatMap(p => p.summary),
    participants: [...new Set(parts.flatMap(p => p.participants))],
    decisions: parts.flatMap(p => p.decisions),
    actionItems: parts.flatMap(p => p.actionItems),
    nextSteps: parts.flatMap(p => p.nextSteps),
  };

  // If small enough, consolidate with LLM
  const mergedJson = JSON.stringify(merged);
  if (mergedJson.length < 15000) {
    const mergeStart = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sei un assistente che consolida note di riunione da più segmenti in un unico documento coerente.
Rimuovi duplicati, unisci punti correlati, ordina cronologicamente.
Rispondi in formato JSON con: summary, participants, decisions, actionItems, nextSteps (array di stringhe).`,
        },
        { role: 'user', content: `Consolida queste note da ${parts.length} segmenti:\n\n${mergedJson}` },
      ],
    });
    trackFromResponse('meeting-merge', 'gpt-4o', response, mergeStart);
    const raw = response.choices[0]?.message?.content || '{}';
    return JSON.parse(raw);
  }

  // Too big for LLM → just deduplicate manually
  return merged;
}

export async function generateMeetingNotes(transcript: string): Promise<{ content: unknown }> {
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  });

  // Split transcript into chunks if too long
  const chunks: string[] = [];
  if (transcript.length <= TRANSCRIPT_CHUNK_CHARS) {
    chunks.push(transcript);
  } else {
    // Split at paragraph boundaries
    const paragraphs = transcript.split(/\n\n+/);
    let current = '';
    for (const para of paragraphs) {
      if (current.length + para.length > TRANSCRIPT_CHUNK_CHARS && current) {
        chunks.push(current);
        current = '';
      }
      current += (current ? '\n\n' : '') + para;
    }
    if (current) chunks.push(current);
  }

  console.log(`[meetingNotes] Processing ${chunks.length} transcript chunk(s), total ${transcript.length} chars`);

  // Summarize each chunk
  const parts: MeetingNotesStructured[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[meetingNotes] Summarizing chunk ${i + 1}/${chunks.length}`);
    const notes = await summarizeTranscriptChunk(chunks[i], i, chunks.length);
    parts.push(notes);
  }

  // Merge all parts
  const parsed = await mergeNotes(parts);

  // Build TipTap JSON content
  const content: unknown[] = [
    heading(2, `📋 Note Riunione — ${today}`),
    { type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'italic' }], text: `ℹ️ Registrazione automatica via Nexus AI (${chunks.length > 1 ? `${chunks.length} segmenti analizzati` : 'analisi completa'})` },
    ] },
  ];

  if (parsed.participants.length > 0) {
    content.push(heading(3, '👥 Partecipanti'));
    content.push(bulletList(parsed.participants));
  }

  if (parsed.summary.length > 0) {
    content.push(heading(3, '📝 Riassunto'));
    content.push(bulletList(parsed.summary));
  }

  if (parsed.decisions.length > 0) {
    content.push(heading(3, '✅ Decisioni'));
    content.push(bulletList(parsed.decisions));
  }

  if (parsed.actionItems.length > 0) {
    content.push(heading(3, '🎯 Action Items'));
    content.push(taskList(parsed.actionItems));
  }

  if (parsed.nextSteps.length > 0) {
    content.push(heading(3, '📌 Prossimi Passi'));
    content.push(bulletList(parsed.nextSteps));
  }

  // Full transcript as blockquote (details node may not be registered in all editor configs)
  content.push(heading(3, '📄 Trascrizione completa'));
  const truncatedTranscript = transcript.length > 100000
    ? transcript.slice(0, 100000) + '\n\n[...troncata...]'
    : transcript;
  content.push({
    type: 'blockquote',
    content: truncatedTranscript.split('\n').filter(Boolean).map(line => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  });

  return {
    content: { type: 'doc', content },
  };
}

// — TipTap JSON helpers —

function heading(level: number, text: string) {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  };
}

function callout(type: string, text: string) {
  return {
    type: 'callout',
    attrs: { type },
    content: [
      { type: 'paragraph', content: [{ type: 'text', text }] },
    ],
  };
}

function bulletList(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: item }] },
      ],
    })),
  };
}

function taskList(items: string[]) {
  return {
    type: 'taskList',
    content: items.map(item => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: item }] },
      ],
    })),
  };
}

function details(summary: string, bodyText: string) {
  return {
    type: 'details',
    content: [
      {
        type: 'detailsSummary',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: summary }] },
        ],
      },
      {
        type: 'detailsContent',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: bodyText }] },
        ],
      },
    ],
  };
}
