const BASE = '/wiki/api';

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

export interface AiWriteRequest {
  action: AiAction;
  text: string;
  targetLang?: string;
  tone?: string;
  context?: string;
}

export async function translatePage(pageId: string, targetLang: string): Promise<void> {
  const res = await fetch(`${BASE}/pages/${pageId}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLang }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Errore traduzione (HTTP ${res.status})`;
    try {
      const body = JSON.parse(text);
      if (body.error) msg = body.error;
    } catch {
      if (text.startsWith('<!')) msg = 'Timeout o errore di rete — riprova';
    }
    throw new Error(msg);
  }
}

export async function translatePagePreview(
  pageId: string,
  targetLang: string,
): Promise<{ content: Record<string, unknown>; title: string }> {
  const res = await fetch(`${BASE}/pages/${pageId}/translate/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLang }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Errore traduzione (HTTP ${res.status})`;
    try {
      const body = JSON.parse(text);
      if (body.error) msg = body.error;
    } catch {
      if (text.startsWith('<!')) msg = 'Timeout o errore di rete — riprova';
    }
    throw new Error(msg);
  }

  const json = await res.json();
  return json.data;
}

export async function aiWrite(params: AiWriteRequest): Promise<string> {
  const res = await fetch(`${BASE}/ai/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Errore di rete' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data.result;
}
