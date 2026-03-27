import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

interface PresenceUser {
  id: string;
  name: string | null;
  email: string;
}

interface PagePresenceProps {
  pageId: string;
}

export function PagePresence({ pageId }: PagePresenceProps) {
  const [editors, setEditors] = useState<PresenceUser[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!pageId || !user) return;

    const socket = getSocket(user.email);
    socket.emit('join-page', pageId);

    const handleEditors = (data: { pageId: string; editors: PresenceUser[] }) => {
      if (data.pageId === pageId) {
        setEditors(data.editors.filter((e) => e.id !== user.id));
      }
    };

    const handleJoined = (data: { pageId: string; user: PresenceUser }) => {
      if (data.pageId === pageId && data.user.id !== user.id) {
        setEditors((prev) => {
          if (prev.some((e) => e.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    };

    const handleLeft = (data: { pageId: string; user: PresenceUser }) => {
      if (data.pageId === pageId) {
        setEditors((prev) => prev.filter((e) => e.id !== data.user.id));
      }
    };

    socket.on('page-editors', handleEditors);
    socket.on('user-joined-page', handleJoined);
    socket.on('user-left-page', handleLeft);

    return () => {
      socket.emit('leave-page', pageId);
      socket.off('page-editors', handleEditors);
      socket.off('user-joined-page', handleJoined);
      socket.off('user-left-page', handleLeft);
      setEditors([]);
    };
  }, [pageId, user]);

  if (editors.length === 0) return null;

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];

  return (
    <div className="flex items-center gap-1">
      <AnimatePresence>
        {editors.map((editor, i) => (
          <motion.div
            key={editor.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            title={`${editor.name || editor.email} sta modificando`}
            className={`h-6 w-6 rounded-full ${colors[i % colors.length]} text-white flex items-center justify-center text-[10px] font-medium ring-2 ring-bg-primary -ml-1 first:ml-0`}
          >
            {getInitials(editor.name, editor.email)}
          </motion.div>
        ))}
      </AnimatePresence>
      <span className="text-xs text-text-muted ml-1">
        {editors.length === 1
          ? `${editors[0].name || editors[0].email} sta modificando`
          : `${editors.length} persone stanno modificando`}
      </span>
    </div>
  );
}
