import type { ApiResponse } from '@/types';

const BASE = '/wiki/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Errore di rete' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const json = await res.json() as ApiResponse<T>;
  return json.data;
}

export function get<T>(path: string) {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function put<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export async function upload<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      formData.append(k, v);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Errore upload' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const json = await res.json() as ApiResponse<T>;
  return json.data;
}

export function uploadWithProgress<T>(
  path: string,
  file: File,
  extra?: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        formData.append(k, v);
      }
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<T>;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json.data);
        } else {
          reject(new Error((json as any).error || `HTTP ${xhr.status}`));
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Errore di rete')));
    xhr.addEventListener('abort', () => reject(new Error('Upload annullato')));

    xhr.open('POST', `${BASE}${path}`);
    xhr.send(formData);
  });
}
