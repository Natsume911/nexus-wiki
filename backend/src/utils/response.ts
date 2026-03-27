import type { Response } from 'express';

export function success<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function error(res: Response, message: string, status = 400, details?: unknown) {
  return res.status(status).json({ error: message, ...(details ? { details } : {}) });
}
