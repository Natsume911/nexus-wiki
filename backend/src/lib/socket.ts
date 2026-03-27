import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from './prisma.js';
import { createActivity } from '../services/activityService.js';

let io: Server;

export function initSocket(httpServer: HttpServer) {
  const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://wiki.example.com' : '*');
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  io.on('connection', async (socket: Socket) => {
    const email = socket.handshake.auth?.email || socket.handshake.query?.email;

    // Resolve user from email — reject if not found
    let user: { id: string; name: string | null; email: string } | null = null;
    if (email) {
      user = await prisma.user.findUnique({
        where: { email: email as string },
        select: { id: true, name: true, email: true },
      });
    }

    if (!user) {
      socket.disconnect();
      return;
    }

    socket.data.user = user;

    // Join page room for real-time presence
    socket.on('join-page', (pageId: string) => {
      socket.join(`page:${pageId}`);
      socket.data.currentPageId = pageId;

      // Broadcast to others on this page that someone joined
      if (user) {
        socket.to(`page:${pageId}`).emit('user-joined-page', {
          pageId,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }

      // Send current editors list to the joining user
      const room = io.sockets.adapter.rooms.get(`page:${pageId}`);
      if (room) {
        const editors: { id: string; name: string | null; email: string }[] = [];
        for (const sid of room) {
          const s = io.sockets.sockets.get(sid);
          if (s?.data.user && s.id !== socket.id) {
            editors.push(s.data.user);
          }
        }
        socket.emit('page-editors', { pageId, editors });
      }
    });

    socket.on('leave-page', (pageId: string) => {
      socket.leave(`page:${pageId}`);
      if (user) {
        socket.to(`page:${pageId}`).emit('user-left-page', {
          pageId,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }
    });

    // Join space room for activity feed
    socket.on('join-space', (spaceId: string) => {
      socket.join(`space:${spaceId}`);
    });

    socket.on('leave-space', (spaceId: string) => {
      socket.leave(`space:${spaceId}`);
    });

    socket.on('disconnect', () => {
      // Notify all page rooms this user was in
      if (user && socket.data.currentPageId) {
        socket.to(`page:${socket.data.currentPageId}`).emit('user-left-page', {
          pageId: socket.data.currentPageId,
          user: { id: user.id, name: user.name, email: user.email },
        });
      }
    });
  });

  return io;
}

export function getIO(): Server {
  return io;
}

// Emit helpers for use in route handlers
export function emitPageUpdated(pageId: string, spaceId: string, data: {
  title: string;
  updatedBy: { id: string; name: string | null; email: string };
}) {
  if (!io) return;
  io.to(`page:${pageId}`).emit('page-updated', { pageId, ...data });
  io.to(`space:${spaceId}`).emit('activity', {
    type: 'page-updated',
    pageId,
    ...data,
    timestamp: new Date().toISOString(),
  });
  createActivity({ type: 'page-updated', spaceId, pageId, userId: data.updatedBy.id, metadata: { title: data.title } }).catch(() => {});
}

export function emitPageCreated(spaceId: string, data: {
  pageId: string;
  title: string;
  createdBy: { id: string; name: string | null; email: string };
}) {
  if (!io) return;
  io.to(`space:${spaceId}`).emit('page-created', data);
  io.to(`space:${spaceId}`).emit('activity', {
    type: 'page-created',
    ...data,
    timestamp: new Date().toISOString(),
  });
  createActivity({ type: 'page-created', spaceId, pageId: data.pageId, userId: data.createdBy.id, metadata: { title: data.title } }).catch(() => {});
}

export function emitPageDeleted(spaceId: string, data: {
  pageId: string;
  title: string;
  deletedBy: { id: string; name: string | null; email: string };
}) {
  if (!io) return;
  io.to(`space:${spaceId}`).emit('page-deleted', data);
  io.to(`space:${spaceId}`).emit('activity', {
    type: 'page-deleted',
    ...data,
    timestamp: new Date().toISOString(),
  });
  createActivity({ type: 'page-deleted', spaceId, pageId: data.pageId, userId: data.deletedBy.id, metadata: { title: data.title } }).catch(() => {});
}

export function emitCommentAdded(pageId: string, spaceId: string, data: {
  commentId: string;
  pageTitle: string;
  author: { id: string; name: string | null; email: string };
}) {
  if (!io) return;
  io.to(`page:${pageId}`).emit('comment-added', { pageId, ...data });
  io.to(`space:${spaceId}`).emit('activity', {
    type: 'comment-added',
    pageId,
    ...data,
    timestamp: new Date().toISOString(),
  });
  createActivity({ type: 'comment-added', spaceId, pageId, userId: data.author.id, metadata: { pageTitle: data.pageTitle } }).catch(() => {});
}
