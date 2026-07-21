import { z } from 'zod';

export const createRoomSchema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  description: z.string().optional()
});

export const updateRoomSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).toUpperCase().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});
