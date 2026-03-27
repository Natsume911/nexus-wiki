import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { createUser, prisma } from '../helpers/factories.js';

describe('Audit Log', () => {
  const app = createTestApp();
  let admin: any;

  beforeEach(async () => {
    admin = await createUser({ email: 'test@nexus.dev', role: 'ADMIN' });
    // Seed some audit entries
    await prisma.auditLog.createMany({
      data: [
        { userEmail: admin.email, action: 'CREATE', resourceType: 'PAGE', resourceTitle: 'Test Page 1' },
        { userEmail: admin.email, action: 'UPDATE', resourceType: 'PAGE', resourceTitle: 'Test Page 1' },
        { userEmail: admin.email, action: 'DELETE', resourceType: 'SPACE', resourceTitle: 'Old Space' },
      ],
    });
  });

  it('should query audit logs', async () => {
    const res = await request(app).get('/api/admin/audit');
    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.total).toBeGreaterThanOrEqual(3);
  });

  it('should filter by action', async () => {
    const res = await request(app).get('/api/admin/audit?action=CREATE');
    expect(res.status).toBe(200);
    for (const log of res.body.data.logs) {
      expect(log.action).toBe('CREATE');
    }
  });

  it('should filter by resource type', async () => {
    const res = await request(app).get('/api/admin/audit?resourceType=SPACE');
    expect(res.status).toBe(200);
    for (const log of res.body.data.logs) {
      expect(log.resourceType).toBe('SPACE');
    }
  });

  it('should export CSV', async () => {
    const res = await request(app).get('/api/admin/audit/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Timestamp,Utente');
  });
});
