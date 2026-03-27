import { get, post, put, del } from './client';

export const getTemplates = (spaceId?: string) => get(`/templates${spaceId ? `?spaceId=${spaceId}` : ''}`);
export const getTemplate = (id: string) => get(`/templates/${id}`);
export const createTemplate = (data: { title: string; description?: string; icon?: string; content: unknown; spaceId?: string }) => post('/templates', data);
export const deleteTemplate = (id: string) => del(`/templates/${id}`);
export const seedTemplates = () => post('/templates/seed', {});
