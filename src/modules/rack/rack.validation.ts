import { z } from 'zod';

export const createRackSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  description: z.string().max(500).optional(),
  floor: z.string().max(100).optional()
});

export const updateRackSchema = z.object({
  roomId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).toUpperCase().optional(),
  description: z.string().max(500).optional(),
  floor: z.string().max(100).optional(),
  isActive: z.boolean().optional()
});
