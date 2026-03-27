import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace, createPage, createComment } from '../helpers/factories.js';

describe('Comments', () => {
  const app = createTestApp();
  let user: any;
  let space: any;
  let page: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
    space = await createSpace(user.id);
    page = await createPage(space.id, user.id);
  });

  it('should create a comment', async () => {
    const res = await request(app)
      .post(`/api/pages/${page.id}/comments`)
      .send({ content: 'Great guide!' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Great guide!');
  });

  it('should list comments for a page', async () => {
    await createComment(page.id, user.id, 'Comment 1');
    await createComment(page.id, user.id, 'Comment 2');
    const res = await request(app).get(`/api/pages/${page.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
