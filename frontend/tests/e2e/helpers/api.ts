const BASE = 'http://localhost:4000/api';

async function apiRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Request-Email': 'e2e@nexus.dev',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.data;
}

export async function createTestSpace(name: string) {
  return apiRequest('POST', '/spaces', { name, description: 'E2E test space' });
}

export async function createTestPage(spaceSlug: string, title: string, parentId?: string) {
  return apiRequest('POST', `/spaces/${spaceSlug}/pages`, { title, parentId });
}

export async function deleteTestSpace(spaceId: string) {
  try {
    return apiRequest('DELETE', `/spaces/${spaceId}`);
  } catch { /* ignore cleanup errors */ }
}
