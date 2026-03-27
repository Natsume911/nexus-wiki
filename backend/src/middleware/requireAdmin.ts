import type { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'ADMIN') {
    return error(res, 'Accesso riservato agli amministratori', 403);
  }
  next();
}
