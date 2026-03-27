import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket(user.email);
    socketRef.current = socket;

    // Global notification listeners
    socket.on('page-created', (data: { title: string; createdBy: { name: string | null; email: string } }) => {
      if (data.createdBy.email !== user.email) {
        addToast(`${data.createdBy.name || data.createdBy.email} ha creato "${data.title}"`, 'info');
      }
    });

    socket.on('page-deleted', (data: { title: string; deletedBy: { name: string | null; email: string } }) => {
      if (data.deletedBy.email !== user.email) {
        addToast(`${data.deletedBy.name || data.deletedBy.email} ha eliminato "${data.title}"`, 'info');
      }
    });

    socket.on('comment-added', (data: { pageTitle: string; author: { name: string | null; email: string } }) => {
      if (data.author.email !== user.email) {
        addToast(`${data.author.name || data.author.email} ha commentato su "${data.pageTitle}"`, 'info');
      }
    });

    return () => {
      socket.off('page-created');
      socket.off('page-deleted');
      socket.off('comment-added');
    };
  }, [user, addToast]);

  return socketRef;
}

export function usePagePresence(pageId: string | undefined) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!pageId || !user) return;

    const socket = getSocket(user.email);
    socket.emit('join-page', pageId);

    return () => {
      socket.emit('leave-page', pageId);
    };
  }, [pageId, user]);
}

export function useSpacePresence(spaceId: string | undefined) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!spaceId || !user) return;

    const socket = getSocket(user.email);
    socket.emit('join-space', spaceId);

    return () => {
      socket.emit('leave-space', spaceId);
    };
  }, [spaceId, user]);
}
