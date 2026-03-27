import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace } from '../helpers/factories.js';

describe('Permissions', () => {
  const app = createTestApp();
  let admin: any;
  let viewer: any;
  let space: any;

  beforeEach(async () => {
    admin = await createUser({ email: 'test@nexus.dev', role: 'ADMIN' });
    viewer = await createUser({ email: 'viewer@test.dev', role: 'VIEWER' });
    space = await createSpace(admin.id);
  });

  it('should grant a permission', async () => {
    const res = await request(app)
      .put(`/api/spaces/${space.id}/permissions`)
      .send({ userId: viewer.id, role: 'EDITOR' });
    expect(res.status).toBe(200);
  });

  it('should list permissions for a space', async () => {
    const res = await request(app).get(`/api/spaces/${space.id}/permissions`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should remove a permission', async () => {
    // First grant
    await request(app)
      .put(`/api/spaces/${space.id}/permissions`)
      .send({ userId: viewer.id, role: 'VIEWER' });
    // Then remove
    const res = await request(app).delete(`/api/spaces/${space.id}/permissions/${viewer.id}`);
    expect(res.status).toBe(200);
  });
});
