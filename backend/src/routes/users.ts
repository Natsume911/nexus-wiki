import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { success } from '../utils/response.js';

const router = Router();

const COLLAB_SECRET = process.env.COLLAB_JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('COLLAB_JWT_SECRET is required in production');
  return 'nexus-collab-dev-only-secret';
})();

// GET /api/users/me
router.get('/me', (req, res) => {
  success(res, req.user);
});

// GET /api/users/collab-token — get signed token for WebSocket collab
router.get('/collab-token', (req, res) => {
  const token = jwt.sign(
    { userId: req.user.id, email: req.user.email, role: req.user.role },
    COLLAB_SECRET,
    { expiresIn: '24h' },
  );
  success(res, { token });
});

export { COLLAB_SECRET };

export default router;
