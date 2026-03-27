import { z } from 'zod';

export const createSpaceSchema = z.object({
  name: z.string().min(1, 'Nome richiesto').max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
});
