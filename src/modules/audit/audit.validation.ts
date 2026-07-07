import { z } from 'zod';
import { WorkflowAction } from '@prisma/client';

export const listAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  boxId: z.string().uuid().optional(),
  fileRecordId: z.string().uuid().optional(),
  action: z.nativeEnum(WorkflowAction).optional(),
  start: z.string().transform((val) => new Date(val)).optional(),
  end: z.string().transform((val) => new Date(val)).optional(),
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100).default(20))
});
