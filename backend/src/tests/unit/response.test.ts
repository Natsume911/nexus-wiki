import { describe, it, expect, vi } from 'vitest';
import { success, error } from '../../utils/response.js';
import type { Response } from 'express';

function mockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('response utils', () => {
  describe('success', () => {
    it('should return 200 with data by default', () => {
      const res = mockResponse();
      success(res, { foo: 'bar' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: { foo: 'bar' } });
    });

    it('should return custom status code', () => {
      const res = mockResponse();
      success(res, { id: '1' }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('error', () => {
    it('should return 400 with error message by default', () => {
      const res = mockResponse();
      error(res, 'Something went wrong');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });

    it('should return custom status code', () => {
      const res = mockResponse();
      error(res, 'Not found', 404);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should include details when provided', () => {
      const res = mockResponse();
      error(res, 'Validation error', 400, [{ field: 'name' }]);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation error', details: [{ field: 'name' }] });
    });
  });
});
