import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace, createPage } from '../helpers/factories.js';

describe('Trash', () => {
  const app = createTestApp();
  let user: any;
  let space: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
    space = await createSpace(user.id);
  });

  it('should soft-delete a page (trash)', async () => {
    const page = await createPage(space.id, user.id);
    const res = await request(app).post(`/api/pages/${page.id}/trash`);
    expect(res.status).toBe(200);
  });

  it('should list trashed pages', async () => {
    const page = await createPage(space.id, user.id);
    await request(app).post(`/api/pages/${page.id}/trash`);
    const res = await request(app).get(`/api/spaces/${space.slug}/trash`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should restore a trashed page', async () => {
    const page = await createPage(space.id, user.id);
    await request(app).post(`/api/pages/${page.id}/trash`);
    const res = await request(app).post(`/api/pages/${page.id}/restore`);
    expect(res.status).toBe(200);
  });

  it('should permanently delete a page', async () => {
    // Permanent delete requires ADMIN role
    const admin = await createUser({ email: 'admin@nexus.dev', role: 'ADMIN' });
    const page = await createPage(space.id, admin.id);
    await request(app).post(`/api/pages/${page.id}/trash`);
    const res = await request(app).delete(`/api/pages/${page.id}/permanent`).set('x-auth-request-email', admin.email);
    expect(res.status).toBe(200);
  });
});
