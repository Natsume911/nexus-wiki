import OpenAI from 'openai';
import { trackFromResponse } from './llmUsageService.js';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurata');
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) { return (getOpenAI() as unknown as Record<string | symbol, unknown>)[prop]; },
});

export type AiAction =
  | 'improve'
  | 'fix'
  | 'summarize'
  | 'translate'
  | 'tone'
  | 'continue'
  | 'longer'
  | 'shorter'
  | 'simplify'
  | 'explain';

interface AiWritingParams {
  action: AiAction;
  text: string;
  targetLang?: string;
  tone?: string;
  context?: string;
}

const SYSTEM_PROMPTS: Record<AiAction, (params: AiWritingParams) => string> = {
  improve: () =>
    `Sei un editor professionista. Migliora il testo mantenendo il significato originale. Rendi il testo piu chiaro, fluido e professionale. Rispondi SOLO con il testo migliorato, senza spiegazioni o commenti.`,

  fix: () =>
    `Sei un correttore di bozze esperto. Correggi errori grammaticali, ortografici e di punteggiatura nel testo. NON cambiare il significato o lo stile. Rispondi SOLO con il testo corretto.`,

  summarize: () =>
    `Riassumi il seguente testo in modo conciso, mantenendo i punti chiave. Rispondi SOLO con il riassunto, senza prefissi come "Riassunto:" o simili.`,

  translate: (params) =>
    `Sei un traduttore professionista. Traduci il testo in ${params.targetLang || 'inglese'}. Mantieni il tono e lo stile originale. Rispondi SOLO con la traduzione, senza commenti.`,

  tone: (params) => {
    const tones: Record<string, string> = {
      professional: 'professionale e formale',
      casual: 'informale e amichevole',
      academic: 'accademico e tecnico',
      creative: 'creativo e coinvolgente',
      direct: 'diretto e conciso',
      friendly: 'cordiale e positivo',
    };
    const toneDesc = tones[params.tone || 'professional'] || params.tone || 'professionale';
    return `Riscrivi il testo con un tono ${toneDesc}. Mantieni il significato originale. Rispondi SOLO con il testo riscritto.`;
  },

  continue: (params) =>
    `Continua a scrivere partendo dal testo fornito. Mantieni lo stesso stile, tono e argomento.${params.context ? ` Contesto della pagina: ${params.context}` : ''} Scrivi circa 2-3 paragrafi. Rispondi SOLO con il testo di continuazione (NON ripetere il testo originale).`,

  longer: () =>
    `Espandi il testo aggiungendo dettagli, esempi e approfondimenti. Mantieni lo stile originale. Rispondi SOLO con il testo espanso (il testo completo, non solo le aggiunte).`,

  shorter: () =>
    `Rendi il testo piu conciso rimuovendo ridondanze e semplificando. Mantieni i concetti chiave. Rispondi SOLO con il testo abbreviato.`,

  simplify: () =>
    `Riscrivi il testo usando un linguaggio semplice e accessibile. Evita gergo tecnico dove possibile, oppure spiegalo brevemente. Rispondi SOLO con il testo semplificato.`,

  explain: () =>
    `Spiega il testo fornito in modo chiaro e didattico. Aggiungi contesto se utile. Rispondi SOLO con la spiegazione.`,
};

export async function processAiWriting(params: AiWritingParams): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[params.action](params);

  const start = Date.now();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: params.action === 'fix' ? 0.1 : 0.5,
    max_completion_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.text },
    ],
  });
  trackFromResponse('ai-writing', 'gpt-4o', response, start);

  return response.choices[0]?.message?.content?.trim() || '';
}
