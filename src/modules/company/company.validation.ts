import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(10).toUpperCase()
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
