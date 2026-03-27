import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';

describe('GET /api/health', () => {
  const app = createTestApp();

  it('should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.timestamp).toBeDefined();
  });
});
