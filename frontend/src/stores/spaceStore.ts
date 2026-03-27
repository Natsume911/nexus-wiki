import { create } from 'zustand';
import type { Space } from '@/types';
import * as spacesApi from '@/api/spaces';

interface SpaceState {
  spaces: Space[];
  currentSpace: Space | null;
  loading: boolean;
  fetchSpaces: () => Promise<void>;
  setCurrentSpace: (space: Space | null) => void;
  createSpace: (data: { name: string; description?: string; icon?: string }) => Promise<Space>;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  currentSpace: null,
  loading: false,
  fetchSpaces: async () => {
    set({ loading: true });
    try {
      const spaces = await spacesApi.getSpaces();
      set({ spaces, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  setCurrentSpace: (space) => set({ currentSpace: space }),
  createSpace: async (data) => {
    const space = await spacesApi.createSpace(data);
    set({ spaces: [space, ...get().spaces] });
    return space;
  },
}));
