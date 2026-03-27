import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, createSpace, createPage } from '../helpers/factories.js';

describe('Search', () => {
  const app = createTestApp();
  let user: any;
  let space: any;

  beforeEach(async () => {
    user = await createUser({ email: 'test@nexus.dev' });
    space = await createSpace(user.id);
    // Create pages with searchable content
    await createPage(space.id, user.id, { title: 'Firewall FortiGate NAT Guide' });
    await createPage(space.id, user.id, { title: 'Kubernetes Deploy Runbook' });
    await createPage(space.id, user.id, { title: 'SOC Alert Procedures' });
  });

  it('should return results for title search', async () => {
    const res = await request(app).get('/api/search?q=FortiGate');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('should return empty results for no match', async () => {
    const res = await request(app).get('/api/search?q=zzzznonexistent');
    expect(res.status).toBe(200);
  });

  it('should return suggestions', async () => {
    const res = await request(app).get('/api/search/suggestions?q=Fire');
    expect(res.status).toBe(200);
  });
});
