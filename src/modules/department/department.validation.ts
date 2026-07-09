import { z } from 'zod';

export const createDepartmentSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
