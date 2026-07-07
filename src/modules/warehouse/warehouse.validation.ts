import { z } from 'zod';

export const createWarehouseSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isActive: z.boolean().optional()
});
