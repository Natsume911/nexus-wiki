import { z } from 'zod';

export const createPageSchema = z.object({
  title: z.string().min(1, 'Titolo richiesto').max(300),
  parentId: z.string().optional(),
  content: z.any().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.any().optional(),
});

export const updatePageContentSchema = z.object({
  content: z.any(),
});

export const reorderPagesSchema = z.object({
  pages: z.array(z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    order: z.number().int().min(0),
  })),
});
