import type { Request, Response, NextFunction } from 'express';

export function auditContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || null;
  const userAgent = req.headers['user-agent'] || null;

  req.auditContext = { ipAddress: ip, userAgent };
  next();
}
