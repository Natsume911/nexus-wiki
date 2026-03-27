import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace } from '../helpers/factories.js';

describe('Spaces CRUD', () => {
  const app = createTestApp();
  let user: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
  });

  it('should create a space', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .send({ name: 'Engineering', description: 'Engineering docs' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Engineering');
    expect(res.body.data.slug).toBe('engineering');
  });

  it('should list spaces', async () => {
    await createSpace(user.id, { name: 'Space A' });
    await createSpace(user.id, { name: 'Space B' });
    const res = await request(app).get('/api/spaces');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get space by slug', async () => {
    const space = await createSpace(user.id, { name: 'SOC Procedures' });
    const res = await request(app).get(`/api/spaces/${space.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('SOC Procedures');
  });

  it('should return 404 for unknown slug', async () => {
    const res = await request(app).get('/api/spaces/nonexistent');
    expect(res.status).toBe(404);
  });

  it('should validate create input', async () => {
    const res = await request(app)
      .post('/api/spaces')
      .send({});
    expect(res.status).toBe(400);
  });
});
