import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace, createPage } from '../helpers/factories.js';

describe('Pages CRUD', () => {
  const app = createTestApp();
  let user: any;
  let space: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
    space = await createSpace(user.id, { name: 'Test Space' });
  });

  it('should create a page', async () => {
    const res = await request(app)
      .post(`/api/spaces/${space.slug}/pages`)
      .send({ title: 'Getting Started' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Getting Started');
    expect(res.body.data.slug).toBe('getting-started');
  });

  it('should get page tree', async () => {
    await createPage(space.id, user.id, { title: 'Page A' });
    await createPage(space.id, user.id, { title: 'Page B' });
    const res = await request(app).get(`/api/spaces/${space.slug}/pages`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get page by slug', async () => {
    const page = await createPage(space.id, user.id, { title: 'My Guide', slug: 'my-guide' });
    const res = await request(app).get(`/api/spaces/${space.slug}/pages/my-guide`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('My Guide');
  });

  it('should update page content', async () => {
    const page = await createPage(space.id, user.id);
    const newContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }] };
    const res = await request(app)
      .put(`/api/pages/${page.id}/content`)
      .send({ content: newContent });
    expect(res.status).toBe(200);
  });

  it('should soft-delete a page', async () => {
    const page = await createPage(space.id, user.id);
    const res = await request(app).delete(`/api/pages/${page.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('should support nested pages', async () => {
    const parent = await createPage(space.id, user.id, { title: 'Parent' });
    const res = await request(app)
      .post(`/api/spaces/${space.slug}/pages`)
      .send({ title: 'Child', parentId: parent.id });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toContain('child');
  });

  it('should get breadcrumbs', async () => {
    const parent = await createPage(space.id, user.id, { title: 'Parent' });
    const child = await createPage(space.id, user.id, { title: 'Child', parentId: parent.id });
    const res = await request(app).get(`/api/pages/${child.id}/breadcrumbs`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});
