import { z } from 'zod';

export const reportDateFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional()
});

export const exportReportSchema = z.object({
  reportType: z.enum([
    'OPERATIONS_BY_DAY',
    'PRODUCTIVITY',
    'OCCUPANCY',
    'MISSING_FILES',
    'CLIENT_HOLDINGS'
  ]),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional()
});
