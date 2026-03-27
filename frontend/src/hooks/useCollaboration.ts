import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useAuthStore } from '@/stores/authStore';

export interface Collaborator {
  id: string;
  name: string | null;
  email: string;
  color: string;
  typing?: boolean;
}

interface UseCollaborationReturn {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc | null;
  collaborators: Collaborator[];
  connected: boolean;
  synced: boolean;
  setTyping: (typing: boolean) => void;
  hasUnsyncedChanges: boolean;
  ready: boolean;
}

// Deterministic color from user ID hash
const COLLAB_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length] || '#6366f1';
}

export function useCollaboration(pageId: string | undefined): UseCollaborationReturn {
  const { user } = useAuthStore();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(!pageId); // if no pageId, immediately ready (no collab)
  const [synced, setSynced] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!pageId || !user) return;

    let cancelled = false;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Offline persistence via IndexedDB — survives browser restarts
    const idb = new IndexeddbPersistence(`nexus-page:${pageId}`, ydoc);
    idbRef.current = idb;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/wiki/collaboration`;

    // Get signed collab token, then connect
    (async () => {
      let collabToken = user.email;
      try {
        const r = await fetch('/wiki/api/users/collab-token');
        if (r.ok) {
          const data = await r.json();
          collabToken = data.data.token;
        }
      } catch { /* fallback to email */ }

      if (cancelled) return;

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: `page:${pageId}`,
      document: ydoc,
      token: collabToken,
      onConnect: () => { setConnected(true); setHasUnsyncedChanges(false); },
      onDisconnect: () => setConnected(false),
      onSynced: () => { setSynced(true); setHasUnsyncedChanges(false); },
      onAwarenessUpdate: ({ states }) => {
        const collabs: Collaborator[] = [];
        states.forEach((state, clientId) => {
          if (state.user && clientId !== provider.awareness?.clientID) {
            collabs.push({
              id: state.user.id,
              name: state.user.name,
              email: state.user.email,
              color: getUserColor(state.user.id),
              typing: !!state.typing,
            });
          }
        });
        setCollaborators(collabs);
      },
    });

    // Set awareness for this user
    provider.setAwarenessField('user', {
      id: user.id,
      name: user.name,
      email: user.email,
      color: getUserColor(user.id),
    });

    // Track unsynced changes
    const onUpdate = () => {
      if (!provider.isSynced) {
        setHasUnsyncedChanges(true);
      }
    };
    ydoc.on('update', onUpdate);

    providerRef.current = provider;
    setReady(true);
    })(); // end async IIFE

    return () => {
      cancelled = true;
      if (providerRef.current) providerRef.current.destroy();
      idb.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      idbRef.current = null;
      setConnected(false);
      setSynced(false);
      setHasUnsyncedChanges(false);
      setCollaborators([]);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [pageId, user]);

  const setTyping = useCallback((typing: boolean) => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.setAwarenessField('typing', typing);
    if (typing) {
      // Auto-clear typing after 2s of inactivity
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        provider.setAwarenessField('typing', false);
      }, 2000);
    }
  }, []);

  return {
    provider: providerRef.current,
    ydoc: ydocRef.current,
    collaborators,
    connected,
    synced,
    setTyping,
    hasUnsyncedChanges,
    ready,
  };
}
