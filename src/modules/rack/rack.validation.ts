import { z } from 'zod';

export const createRackSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateRackSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
