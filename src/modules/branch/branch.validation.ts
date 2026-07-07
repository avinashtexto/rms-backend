import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
