import { z } from 'zod';

export const createSiteSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

export const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isActive: z.boolean().optional()
});
