import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(headersSent = false) {
  const req = {} as Request;
  const res = {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('errorHandler', () => {
  it('should return 500 for generic errors', () => {
    const { req, res, next } = mockReqRes();
    errorHandler(new Error('test error'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'test error' });
  });

  it('should use custom statusCode from error', () => {
    const { req, res, next } = mockReqRes();
    const err = Object.assign(new Error('not found'), { statusCode: 404 });
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should not send response if headers already sent', () => {
    const { req, res, next } = mockReqRes(true);
    errorHandler(new Error('test'), req, res, next);
    expect(res.status).not.toHaveBeenCalled();
  });
});
