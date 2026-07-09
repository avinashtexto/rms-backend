import { z } from 'zod';

export const createReasonCodeSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(2).max(20).toUpperCase(),
  label: z.string().min(1),
  appliesTo: z.string().min(1),
  isActive: z.boolean().optional()
});

export const updateReasonCodeSchema = z.object({
  label: z.string().min(1).optional(),
  appliesTo: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});
