import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user: User;
      auditContext?: {
        ipAddress: string | null;
        userAgent: string | null;
      };
    }
  }
}

export {};
