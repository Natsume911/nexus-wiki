import { create } from 'zustand';

export interface UploadItem {
  id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

interface UploadState {
  uploads: UploadItem[];
  addUpload: (id: string, filename: string) => void;
  updateProgress: (id: string, progress: number) => void;
  setDone: (id: string) => void;
  setError: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  uploads: [],
  addUpload: (id, filename) => {
    set((s) => ({
      uploads: [...s.uploads, { id, filename, progress: 0, status: 'uploading' }],
    }));
  },
  updateProgress: (id, progress) => {
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, progress } : u)),
    }));
  },
  setDone: (id) => {
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, progress: 100, status: 'done' } : u)),
    }));
    // Auto-clear after 3s
    setTimeout(() => {
      set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }));
    }, 3000);
  },
  setError: (id) => {
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, status: 'error' } : u)),
    }));
    // Auto-clear errors after 5s
    setTimeout(() => {
      set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }));
    }, 5000);
  },
  clearCompleted: () => {
    set((s) => ({ uploads: s.uploads.filter((u) => u.status === 'uploading') }));
  },
}));
