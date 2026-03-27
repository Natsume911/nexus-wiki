import { create } from 'zustand';
import type { Page, PageTreeNode, Breadcrumb } from '@/types';
import * as pagesApi from '@/api/pages';
import { archivePage as archivePageApi } from '@/api/archive';

interface PageState {
  pageTree: PageTreeNode[];
  currentPage: Page | null;
  breadcrumbs: Breadcrumb[];
  favorited: boolean;
  watching: boolean;
  isSaving: boolean;
  saveError: string | null;
  treeLoading: boolean;
  pageLoading: boolean;
  fetchPageTree: (spaceSlug: string) => Promise<void>;
  fetchPage: (spaceSlug: string, pageSlug: string) => Promise<void>;
  fetchBreadcrumbs: (pageId: string) => Promise<void>;
  setCurrentPage: (page: Page | null) => void;
  setFavorited: (favorited: boolean) => void;
  setWatching: (watching: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
  createPage: (spaceSlug: string, data: { title: string; parentId?: string }) => Promise<Page>;
  deletePage: (id: string, spaceSlug: string) => Promise<void>;
  archivePage: (id: string, spaceSlug: string) => Promise<void>;
  prefetchPage: (spaceSlug: string, pageSlug: string) => void;
}

// Prefetch cache — stores page data for hover-prefetched pages
const prefetchCache = new Map<string, { data: pagesApi.PageFullResponse; ts: number }>();
const PREFETCH_TTL = 30_000; // 30s

export const usePageStore = create<PageState>((set, get) => ({
  pageTree: [],
  currentPage: null,
  breadcrumbs: [],
  favorited: false,
  watching: false,
  isSaving: false,
  saveError: null,
  treeLoading: false,
  pageLoading: false,
  fetchPageTree: async (spaceSlug) => {
    set({ treeLoading: true });
    try {
      const tree = await pagesApi.getPageTree(spaceSlug);
      set({ pageTree: tree, treeLoading: false });
    } catch {
      set({ treeLoading: false });
    }
  },
  fetchPage: async (spaceSlug, pageSlug) => {
    // Check prefetch cache first
    const cacheKey = `${spaceSlug}:${pageSlug}`;
    const cached = prefetchCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PREFETCH_TTL) {
      prefetchCache.delete(cacheKey);
      const { page, breadcrumbs, favorited, watching } = cached.data;
      set({ currentPage: page, breadcrumbs, favorited, watching, pageLoading: false });
      return;
    }

    set({ pageLoading: true });

    // Retry logic — network hiccups shouldn't show "not found"
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await pagesApi.getPageFull(spaceSlug, pageSlug);
        set({
          currentPage: result.page,
          breadcrumbs: result.breadcrumbs,
          favorited: result.favorited,
          watching: result.watching,
          pageLoading: false,
        });
        return;
      } catch {
        try {
          const page = await pagesApi.getPage(spaceSlug, pageSlug);
          set({ currentPage: page, pageLoading: false });
          if (page) get().fetchBreadcrumbs(page.id);
          return;
        } catch {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // 500ms, 1s backoff
            continue;
          }
          set({ currentPage: null, pageLoading: false });
        }
      }
    }
  },
  fetchBreadcrumbs: async (pageId) => {
    try {
      const breadcrumbs = await pagesApi.getBreadcrumbs(pageId);
      set({ breadcrumbs });
    } catch {
      set({ breadcrumbs: [] });
    }
  },
  setCurrentPage: (page) => set({ currentPage: page }),
  setFavorited: (favorited) => set({ favorited }),
  setWatching: (watching) => set({ watching }),
  setSaving: (saving) => set({ isSaving: saving }),
  setSaveError: (error) => set({ saveError: error }),
  createPage: async (spaceSlug, data) => {
    const page = await pagesApi.createPage(spaceSlug, data);
    get().fetchPageTree(spaceSlug);
    return page;
  },
  deletePage: async (id, spaceSlug) => {
    await pagesApi.deletePage(id);
    get().fetchPageTree(spaceSlug);
  },
  archivePage: async (id, spaceSlug) => {
    await archivePageApi(id);
    get().fetchPageTree(spaceSlug);
  },
  prefetchPage: (spaceSlug, pageSlug) => {
    const cacheKey = `${spaceSlug}:${pageSlug}`;
    if (prefetchCache.has(cacheKey)) return;
    // Soft fetch — no loading state
    pagesApi.getPageFull(spaceSlug, pageSlug)
      .then((result) => {
        prefetchCache.set(cacheKey, { data: result, ts: Date.now() });
      })
      .catch(() => {}); // silently fail
  },
}));
