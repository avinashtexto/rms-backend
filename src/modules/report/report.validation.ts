import { z } from 'zod';

export const generateReportSchema = z.object({
  type: z.enum(['BOX_INVENTORY', 'USER_WORKLOAD', 'CUSTODY_HISTORY']),
  name: z.string().min(1).optional(),
  description: z.string().optional()
});

export const updateReportSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
});
