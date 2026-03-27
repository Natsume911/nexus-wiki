import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message, err.stack);

  if (res.headersSent) {
    return;
  }

  const status = 'statusCode' in err ? (err as Error & { statusCode: number }).statusCode : 500;

  // In production, only expose error messages for client errors (4xx).
  // For server errors (5xx), return a generic message to avoid leaking internals.
  const message =
    status < 500 || process.env.NODE_ENV !== 'production'
      ? err.message || 'Errore interno del server'
      : 'Errore interno del server';

  res.status(status).json({ error: message });
}
