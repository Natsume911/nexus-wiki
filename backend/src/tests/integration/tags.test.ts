import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace, createPage, createTag } from '../helpers/factories.js';

describe('Tags', () => {
  const app = createTestApp();
  let user: any;
  let space: any;
  let page: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
    space = await createSpace(user.id);
    page = await createPage(space.id, user.id);
  });

  it('should create a tag', async () => {
    const res = await request(app)
      .post(`/api/pages/${page.id}/tags`)
      .send({ name: 'deployment', color: '#10b981' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('deployment');
  });

  it('should list tags', async () => {
    await createTag('tag-a');
    await createTag('tag-b');
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should attach tag to page', async () => {
    const res = await request(app)
      .post(`/api/pages/${page.id}/tags`)
      .send({ name: 'important', color: '#ef4444' });
    expect(res.status).toBe(201);
  });
});
