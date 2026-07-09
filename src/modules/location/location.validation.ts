import { z } from 'zod';

export const createLocationSchema = z.object({
  shelfId: z.string().uuid(),
  name: z.string().min(1),
  barcode: z.string().min(1)
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  isOccupied: z.boolean().optional(),
  isActive: z.boolean().optional()
});
