import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockReqResNext(body = {}) {
  const req = { body, query: {}, params: {} } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('should call next on valid body', () => {
    const { req, res, next } = mockReqResNext({ name: 'Test' });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 400 on invalid body', () => {
    const { req, res, next } = mockReqResNext({ name: '' });
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return error details', () => {
    const { req, res, next } = mockReqResNext({});
    validate(schema)(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Dati non validi',
      details: expect.any(Array),
    }));
  });
});
