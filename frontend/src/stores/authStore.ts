import { create } from 'zustand';
import type { User } from '@/types';
import { get } from '@/api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  accessDenied: boolean;
  accessDeniedMessage: string | null;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  accessDenied: false,
  accessDeniedMessage: null,
  fetchUser: async () => {
    try {
      const user = await get<User>('/users/me');
      set({ user, loading: false, accessDenied: false, accessDeniedMessage: null });
    } catch (err: any) {
      const msg = err?.message || '';
      // Detect 403 "access denied" responses from backend
      if (msg.includes('Accesso negato') || msg.includes('non è stato abilitato') || msg.includes('non è ancora stato attivato')) {
        set({ user: null, loading: false, accessDenied: true, accessDeniedMessage: msg });
      } else {
        set({ user: null, loading: false, accessDenied: false, accessDeniedMessage: null });
      }
    }
  },
}));
