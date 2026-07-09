import { z } from 'zod';

export const createRoomSchema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
