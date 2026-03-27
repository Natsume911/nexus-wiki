import { upload } from './client';
import type { Page } from '@/types';

export function importMarkdownFile(spaceSlug: string, file: File, parentId?: string) {
  return upload<Page>(
    `/spaces/${spaceSlug}/import/markdown`,
    file,
    parentId ? { parentId } : undefined,
  );
}
