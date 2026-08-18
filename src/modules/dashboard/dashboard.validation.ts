import { z } from 'zod';

export const getDashboardMetricsQuerySchema = z.object({
  companyId: z.string().optional(),
  warehouseId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional().default(7),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.string().optional(),
  operationType: z.string().optional()
});

export type DashboardQueryInput = z.infer<typeof getDashboardMetricsQuerySchema>;
