import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { cached, CacheKeys, cacheInvalidate } from '../services/cacheService.js';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Get email from OAuth2-Proxy header or dev bypass
    let email = req.headers['x-auth-request-email'] as string | undefined;

    if (!email && process.env.DEV_USER_EMAIL && process.env.NODE_ENV === 'development') {
      email = process.env.DEV_USER_EMAIL;
    }

    if (!email) {
      return res.status(401).json({ error: 'Non autenticato' });
    }

    // Look up user (cached for 5 min)
    const user = await cached(CacheKeys.user(email), 300, async () => {
      return prisma.user.findUnique({ where: { email } });
    });

    if (!user) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Il tuo account non è stato abilitato alla wiki. Contatta un amministratore.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        error: 'Accesso negato',
        message: 'Il tuo account non è ancora stato attivato. Contatta un amministratore.',
        code: 'USER_INACTIVE',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
