import { get, upload, uploadWithProgress, del } from './client';
import type { Attachment, UploadResponse } from '@/types';

export function getAttachments(spaceSlug: string) {
  return get<Attachment[]>(`/spaces/${spaceSlug}/attachments`);
}

export function getPageAttachments(spaceSlug: string, pageId: string) {
  return get<Attachment[]>(`/spaces/${spaceSlug}/attachments?pageId=${pageId}`);
}

export function uploadFile(spaceSlug: string, file: File, pageId?: string) {
  return upload<UploadResponse>(
    `/spaces/${spaceSlug}/attachments`,
    file,
    pageId ? { pageId } : undefined,
  );
}

export function uploadFileWithProgress(
  spaceSlug: string,
  file: File,
  pageId?: string,
  onProgress?: (percent: number) => void,
) {
  return uploadWithProgress<UploadResponse>(
    `/spaces/${spaceSlug}/attachments`,
    file,
    pageId ? { pageId } : undefined,
    onProgress,
  );
}

export function deleteAttachment(id: string) {
  return del<{ deleted: boolean }>(`/attachments/${id}`);
}
