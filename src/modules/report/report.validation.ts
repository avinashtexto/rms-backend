import { z } from 'zod';

export const generateReportSchema = z.object({
  type: z.enum(['BOX_INVENTORY', 'USER_WORKLOAD', 'CUSTODY_HISTORY'])
});
