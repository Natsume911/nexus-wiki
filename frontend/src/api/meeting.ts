const BASE = '/wiki/api';

export interface MeetingNotesResponse {
  transcript: string;
  content: Record<string, unknown>;
  audioUrl: string;
}

export async function transcribeMeetingAudio(audioFile: File): Promise<MeetingNotesResponse> {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const res = await fetch(`${BASE}/meeting/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Errore di rete' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}
