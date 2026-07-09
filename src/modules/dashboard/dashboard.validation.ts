import { z } from 'zod';

export const getDashboardMetricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(7),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10)
});
