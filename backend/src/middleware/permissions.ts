import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Check if user has at least the required role for the space.
 * Role hierarchy: ADMIN > EDITOR > VIEWER
 */
function roleAtLeast(userRole: string, required: string): boolean {
  const hierarchy: Record<string, number> = { VIEWER: 1, EDITOR: 2, ADMIN: 3 };
  return (hierarchy[userRole] || 0) >= (hierarchy[required] || 0);
}

/**
 * Middleware: require space-level permission.
 * Extracts spaceSlug from req.params.spaceSlug or spaceId from req.params.spaceId or req.body.spaceId.
 * If the user is a global ADMIN, always allow.
 */
export function requireSpaceAccess(minRole: 'VIEWER' | 'EDITOR' | 'ADMIN' = 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Non autenticato' });

      // Global ADMIN always bypasses everything
      if (user.role === 'ADMIN') return next();

      // Determine space
      let spaceId: string | undefined;
      const spaceSlug = req.params.spaceSlug || req.params.slug;

      if (spaceSlug) {
        const space = await prisma.space.findUnique({ where: { slug: spaceSlug }, select: { id: true } });
        if (!space) return res.status(404).json({ error: 'Spazio non trovato' });
        spaceId = space.id;
      } else if (req.params.spaceId) {
        spaceId = req.params.spaceId;
      }

      if (!spaceId) {
        const genericId = req.params.id || req.params.pageId;
        if (genericId) {
          const space = await prisma.space.findUnique({ where: { id: genericId }, select: { id: true } });
          if (space) {
            spaceId = space.id;
          } else {
            const page = await prisma.page.findUnique({ where: { id: genericId }, select: { spaceId: true } });
            if (page) {
              spaceId = page.spaceId;
            } else {
              const attachment = await prisma.attachment.findUnique({ where: { id: genericId }, select: { spaceId: true } });
              if (attachment) spaceId = attachment.spaceId;
            }
          }
        }
      }

      if (!spaceId) return next(); // No space context → allow

      // Load space to check if restricted
      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        select: { createdById: true, isRestricted: true },
      });

      // Space creator always has full access
      if (space?.createdById === user.id) return next();

      // Check SpacePermission
      const perm = await prisma.spacePermission.findUnique({
        where: { spaceId_userId: { spaceId, userId: user.id } },
      });

      if (space?.isRestricted) {
        // Restricted space: MUST have explicit SpacePermission
        if (!perm) {
          return res.status(403).json({ error: 'Non hai accesso a questo spazio' });
        }
        if (!roleAtLeast(perm.role, minRole)) {
          return res.status(403).json({ error: 'Permessi insufficienti per questo spazio' });
        }
      } else {
        // Open space: global role applies, SpacePermission overrides if present
        if (perm) {
          if (!roleAtLeast(perm.role, minRole)) {
            return res.status(403).json({ error: 'Permessi insufficienti per questo spazio' });
          }
        } else {
          // No explicit perm on open space → use global role
          if (!roleAtLeast(user.role, minRole)) {
            return res.status(403).json({ error: 'Permessi insufficienti per questo spazio' });
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: require page-level permission if set.
 * Falls back to space permission if no page-level permission exists.
 */
export function requirePageAccess(minRole: 'VIEWER' | 'EDITOR' | 'ADMIN' = 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Non autenticato' });

      // Global admins bypass
      if (user.role === 'ADMIN') return next();

      const pageId = req.params.id || req.params.pageId;
      if (!pageId) return next();

      // Check page-level permission first
      const pagePerm = await prisma.pagePermission.findUnique({
        where: { pageId_userId: { pageId, userId: user.id } },
      });

      if (pagePerm) {
        if (!roleAtLeast(pagePerm.role, minRole)) {
          return res.status(403).json({ error: 'Permessi insufficienti per questa pagina' });
        }
        return next();
      }

      // No page-level perm — fall through to space-level (handled by space middleware or allow)
      next();
    } catch (err) {
      next(err);
    }
  };
}
